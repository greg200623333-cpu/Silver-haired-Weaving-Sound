-- ============================================================
-- 银发织音 (SilverVoice) — Supabase PostgreSQL Schema
-- 极简鉴权设计：子女扫码绑定 → 老人免密一键进入
-- ============================================================

-- 0. 扩展
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- 1. 核心用户表（老人 & 监护人统一存储，通过 role 区分）
-- ------------------------------------------------------------
create table public.profiles (
  id            uuid primary key default uuid_generate_v4(),
  wechat_openid text unique,                -- 微信 openid，免密登录凭据
  role          text not null check (role in ('elder', 'guardian')),
  nickname      text not null default '未命名',
  avatar_url    text,
  phone         text,
  birth_year    int,                         -- 老人专属：出生年份（用于推算年龄和年代背景）
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. 绑定关系表（子女-老人多对多，一个子女可绑定多位老人）
-- ------------------------------------------------------------
create table public.bindings (
  id            uuid primary key default uuid_generate_v4(),
  guardian_id   uuid not null references public.profiles(id) on delete cascade,
  elder_id      uuid not null references public.profiles(id) on delete cascade,
  relation      text,                        -- 关系标签：儿子 / 女儿 / 孙子 / 护工
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique(guardian_id, elder_id)
);

-- ------------------------------------------------------------
-- 3. 记忆片段表（核心业务表）
-- ------------------------------------------------------------
create table public.memories (
  id              uuid primary key default uuid_generate_v4(),
  elder_id        uuid not null references public.profiles(id) on delete cascade,
  recorded_by     uuid references public.profiles(id),    -- 谁帮老人录的（可为空 = 老人自己）

  -- 语音 & 转写
  voice_url       text,                                    -- 原始录音文件 URL（Supabase Storage）
  raw_text        text not null,                           -- 语音转写原始文本
  polished_text   text,                                    -- LLM 润色后的文学版

  -- 照片
  photo_urls      text[] default '{}',                     -- 关联老照片 URL 数组

  -- 结构化提取
  time_points     jsonb default '[]',                      -- [{year: 1962, event: "结婚"}, ...]
  keywords        text[] default '{}',                     -- 主题关键词
  emotion_tag     text,                                    -- LLM 情绪标签：怀旧/喜悦/感伤/平静
  emotion_score   numeric(3,2),                            -- 情绪强度 0.00~1.00（热力图数据源）

  -- 等幂与溯源
  idempotency_key text unique,                             -- 前端生成 UUID，防重复提交

  -- 元数据
  duration_secs   int,                                     -- 录音时长（秒）
  is_favorite     boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_memories_elder on public.memories(elder_id, created_at desc);

-- ------------------------------------------------------------
-- 4. 陪伴聊天记录表
-- ------------------------------------------------------------
create table public.chat_logs (
  id            uuid primary key default uuid_generate_v4(),
  elder_id      uuid not null references public.profiles(id) on delete cascade,

  role          text not null check (role in ('elder', 'assistant')),
  content       text not null,                              -- 消息正文（≤50字，适合TTS）

  -- 上下文追溯
  memory_id     uuid references public.memories(id),        -- 本轮聊天引用的记忆
  emotion_hint  text,                                       -- LLM 判定的老人情绪
  emotion_score numeric(3,2),                               -- 情绪强度 0.00~1.00

  -- 等幂与溯源
  idempotency_key text unique,                             -- 前端生成 UUID，防重复提交

  created_at    timestamptz not null default now()
);

create index idx_chat_elder on public.chat_logs(elder_id, created_at desc);

-- ------------------------------------------------------------
-- 5. 处理日志表（LLM 原始响应持久化兜底，防止 DeepSeek 成功但存库失败）
-- ------------------------------------------------------------
create table public.processing_logs (
  id            uuid primary key default uuid_generate_v4(),
  elder_id      uuid not null references public.profiles(id) on delete cascade,
  raw_text      text not null,
  llm_response  text not null,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. 记忆知识图谱 — 实体与关系（跨对话记忆关联）
-- ------------------------------------------------------------
create table public.memory_entities (
  id            uuid primary key default uuid_generate_v4(),
  memory_id     uuid not null references public.memories(id) on delete cascade,
  elder_id      uuid not null references public.profiles(id) on delete cascade,
  entity_type   text not null check (entity_type in ('person', 'place', 'event', 'object', 'time_period')),
  name          text not null,
  attributes    jsonb default '{}',           -- { gender: '女', relation: '爱人', era: '1960s' }
  confidence    numeric(3,2) default 1.00,    -- LLM 提取置信度
  created_at    timestamptz not null default now()
);

create index idx_entities_memory on public.memory_entities(memory_id);
create index idx_entities_elder on public.memory_entities(elder_id);
create index idx_entities_name on public.memory_entities using gin (name gin_trgm_ops);

create table public.memory_relations (
  id              uuid primary key default uuid_generate_v4(),
  memory_id       uuid not null references public.memories(id) on delete cascade,
  elder_id        uuid not null references public.profiles(id) on delete cascade,
  subject_entity  uuid not null references public.memory_entities(id) on delete cascade,
  predicate       text not null,              -- 关系谓词: met_at, lived_in, married_to, owned, etc.
  object_entity   uuid not null references public.memory_entities(id) on delete cascade,
  confidence      numeric(3,2) default 1.00,
  created_at      timestamptz not null default now(),
  constraint unique_relation unique (memory_id, subject_entity, predicate, object_entity)
);

create index idx_relations_memory on public.memory_relations(memory_id);
create index idx_relations_elder on public.memory_relations(elder_id);

-- trigram 扩展已在文件头部创建

-- ------------------------------------------------------------
-- 7. 情绪热力图物化视图（加速子女端看板聚合查询）
-- ------------------------------------------------------------
create materialized view public.daily_mood as
select
  elder_id,
  date_trunc('day', created_at) as day,
  emotion_tag,
  count(*) as cnt,
  round(avg(emotion_score), 2) as avg_score
from public.memories
where emotion_tag is not null
group by 1, 2, 3;

create index idx_daily_mood_elder on public.daily_mood(elder_id, day desc);

-- 刷新函数（每天凌晨自动刷新，或由 pg_cron 定时触发）
create or replace function public.refresh_daily_mood()
returns void as $$
begin
  refresh materialized view concurrently public.daily_mood;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 7. 一键登录令牌表（老人端免密登录核心）
-- ------------------------------------------------------------
create table public.magic_tokens (
  id            uuid primary key default uuid_generate_v4(),
  elder_id      uuid not null references public.profiles(id) on delete cascade,
  token         text not null unique,                       -- 短码或 JWT，由监护端生成
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security（允许客户端直连 Supabase 时安全访问）
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bindings   enable row level security;
alter table public.memories   enable row level security;
alter table public.chat_logs  enable row level security;
alter table public.processing_logs enable row level security;
alter table public.memory_entities enable row level security;
alter table public.memory_relations enable row level security;
alter table public.magic_tokens enable row level security;

-- 策略：用户只能读自己的 profile
create policy "profiles_self" on public.profiles
  for select using (id = auth.uid());

-- 策略：监护人可读其绑定的老人 profile
create policy "profiles_guardian_read_elder" on public.profiles
  for select using (
    exists (
      select 1 from public.bindings
      where elder_id = profiles.id and guardian_id = auth.uid()
    )
  );

-- 策略：用户可读写自己的记忆
create policy "memories_elder" on public.memories
  for all using (elder_id = auth.uid());

-- 策略：监护人可读写其所绑定老人的记忆
create policy "memories_guardian" on public.memories
  for all using (
    exists (
      select 1 from public.bindings
      where elder_id = memories.elder_id and guardian_id = auth.uid()
    )
  );

-- 策略：聊天记录同上
create policy "chat_elder" on public.chat_logs
  for all using (elder_id = auth.uid());

create policy "chat_guardian" on public.chat_logs
  for all using (
    exists (
      select 1 from public.bindings
      where elder_id = chat_logs.elder_id and guardian_id = auth.uid()
    )
  );

-- 策略：processing_logs
create policy "logs_elder" on public.processing_logs
  for all using (elder_id = auth.uid());

create policy "logs_guardian" on public.processing_logs
  for all using (
    exists (
      select 1 from public.bindings
      where elder_id = processing_logs.elder_id and guardian_id = auth.uid()
    )
  );

-- 策略：memory_entities
create policy "entities_elder" on public.memory_entities
  for all using (elder_id = auth.uid());

create policy "entities_guardian" on public.memory_entities
  for all using (
    exists (
      select 1 from public.bindings
      where elder_id = memory_entities.elder_id and guardian_id = auth.uid()
    )
  );

-- 策略：memory_relations
create policy "relations_elder" on public.memory_relations
  for all using (elder_id = auth.uid());

create policy "relations_guardian" on public.memory_relations
  for all using (
    exists (
      select 1 from public.bindings
      where elder_id = memory_relations.elder_id and guardian_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 函数：根据 wechat_openid 获取或创建老人 profile（免密登录用）
-- ------------------------------------------------------------
create or replace function public.upsert_elder_by_openid(
  p_openid   text,
  p_nickname text default '银发朋友'
) returns public.profiles as $$
declare
  v_profile public.profiles;
begin
  -- 先查找已有 profile
  select * into v_profile from public.profiles where wechat_openid = p_openid;

  if not found then
    insert into public.profiles (wechat_openid, role, nickname)
    values (p_openid, 'elder', p_nickname)
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$ language plpgsql security definer;
