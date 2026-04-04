-- ============================================================
-- YuanHe (缘合) PostgreSQL Schema — MVP
-- Encoding: UTF-8 (PostgreSQL default)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for text search on posts

-- Enums
CREATE TYPE gender_type AS ENUM ('male', 'female');
CREATE TYPE privacy_level AS ENUM ('standard', 'open', 'private');
CREATE TYPE theme_type AS ENUM ('light', 'dark');
CREATE TYPE swipe_dir AS ENUM ('left', 'right');
CREATE TYPE message_type AS ENUM ('text', 'voice', 'image', 'system');
CREATE TYPE message_role AS ENUM ('user', 'ai', 'system');
CREATE TYPE divination_mode AS ENUM (
  'bazi', 'astrology', 'tarot', 'meihua',
  'vedic', 'hehun', 'synastry', 'hepan'
);

-- ============================================================
-- 1. USERS (用户)
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone         VARCHAR(20) UNIQUE,          -- future: phone login
  wechat_openid VARCHAR(128) UNIQUE,         -- future: WeChat login

  -- Birth info (for fortune calculations)
  birth_year    SMALLINT NOT NULL,
  birth_month   SMALLINT NOT NULL,           -- 1-12
  birth_day     SMALLINT NOT NULL,           -- 1-31
  birth_hour    SMALLINT NOT NULL DEFAULT -1,-- -1 = unknown, 0-23

  -- Profile
  gender        gender_type NOT NULL,
  name          VARCHAR(50) NOT NULL DEFAULT '缘友',
  bio           VARCHAR(500) DEFAULT '',
  city          VARCHAR(100) DEFAULT '',
  avatar        TEXT DEFAULT '',              -- emoji or URL

  -- Preferences
  privacy       privacy_level NOT NULL DEFAULT 'standard',
  theme         theme_type NOT NULL DEFAULT 'light',
  gender_pref   VARCHAR(10) DEFAULT NULL,    -- 'male','female','all'

  -- App state flags
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  onboarded      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matching pool: filter by gender, sorted by activity
CREATE INDEX idx_users_gender_active ON users (gender, last_active_at DESC)
  WHERE privacy != 'private';
CREATE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL;


-- ============================================================
-- 2. SWIPES (滑动记录)
-- ============================================================
CREATE TABLE swipes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction  swipe_dir NOT NULL,

  -- Match score snapshot (from matching engine at swipe time)
  score      SMALLINT,                       -- 0-100
  grade      VARCHAR(10),                    -- e.g. '上等','中等'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, target_id)
);

CREATE INDEX idx_swipes_user_target ON swipes (user_id, target_id);
CREATE INDEX idx_swipes_target_right ON swipes (target_id, direction)
  WHERE direction = 'right';


-- ============================================================
-- 3. MATCHES (匹配 — 双方都右滑后创建)
-- ============================================================
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Compatibility details (snapshot from matching engine)
  score       SMALLINT NOT NULL,
  grade       VARCHAR(10),
  dimensions  JSONB,       -- [{name,score,weight,desc,icon}, ...]
  tags        JSONB,       -- ["天干合","五行互补", ...]
  compatibility JSONB,     -- {type,desc,icon}
  shishen_cross JSONB,     -- {youToThem, themToYou}

  unmatched   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE INDEX idx_matches_user_a ON matches (user_a) WHERE NOT unmatched;
CREATE INDEX idx_matches_user_b ON matches (user_b) WHERE NOT unmatched;


-- ============================================================
-- 4. CONVERSATIONS (会话)
-- ============================================================
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_a      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Denormalized for fast list rendering
  last_message_text VARCHAR(200) DEFAULT '',
  last_message_at   TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (match_id)
);

CREATE INDEX idx_convs_user_a ON conversations (user_a, last_message_at DESC);
CREATE INDEX idx_convs_user_b ON conversations (user_b, last_message_at DESC);


-- ============================================================
-- 5. MESSAGES (消息)
-- ============================================================
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system/bot
  role            message_role NOT NULL DEFAULT 'user',

  msg_type        message_type NOT NULL DEFAULT 'text',
  text            TEXT DEFAULT '',
  media_url       TEXT,                -- voice/image URL
  voice_duration  SMALLINT,            -- seconds, for voice messages

  recalled        BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,         -- NULL = unread

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conv_time ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages (conversation_id, read_at)
  WHERE read_at IS NULL AND role != 'user';


-- ============================================================
-- 6. POSTS (缘友圈帖子)
-- ============================================================
CREATE TABLE posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  content     TEXT NOT NULL,
  tag         VARCHAR(50) DEFAULT '',        -- e.g. '每日一签','命理分享'
  is_bot      BOOLEAN NOT NULL DEFAULT FALSE,

  like_count  INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,

  reported    BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,                   -- soft delete

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_feed ON posts (created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_author ON posts (author_id, created_at DESC);


-- ============================================================
-- 7. POST LIKES (点赞)
-- ============================================================
CREATE TABLE post_likes (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);


-- ============================================================
-- 8. POST COMMENTS (评论)
-- ============================================================
CREATE TABLE post_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON post_comments (post_id, created_at);


-- ============================================================
-- 9. REPORTS (举报)
-- ============================================================
CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL,          -- 'user','post','message'
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. DIVINATION RESULTS (占卜报告)
-- ============================================================
CREATE TABLE divination_results (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode         divination_mode NOT NULL,

  question     TEXT DEFAULT '',
  response     TEXT,                         -- AI response (markdown)
  structured   JSONB,                        -- four pillars, wuxing, tarot cards, etc.
  engine_data  JSONB,                        -- raw engine calculation
  depth        VARCHAR(10) DEFAULT 'expert', -- 'expert' or 'popular'

  -- For paired modes (hehun/synastry/hepan)
  partner_year   SMALLINT,
  partner_month  SMALLINT,
  partner_day    SMALLINT,
  partner_hour   SMALLINT,
  partner_gender gender_type,

  favorited    BOOLEAN NOT NULL DEFAULT FALSE,
  feedback     VARCHAR(4),                   -- 'up' or 'down'

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_divination_user ON divination_results (user_id, created_at DESC);
CREATE INDEX idx_divination_user_mode ON divination_results (user_id, mode, created_at DESC);
CREATE INDEX idx_divination_fav ON divination_results (user_id, favorited)
  WHERE favorited = TRUE;


-- ============================================================
-- 11. DIVINATION FOLLOW-UPS (追问对话)
-- ============================================================
CREATE TABLE divination_followups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  divination_id   UUID NOT NULL REFERENCES divination_results(id) ON DELETE CASCADE,
  role            message_role NOT NULL,      -- 'user' or 'ai'
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_followups_div ON divination_followups (divination_id, created_at);


-- ============================================================
-- 12. MOOD TRACKING (心情打卡)
-- ============================================================
CREATE TABLE mood_entries (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood_date  DATE NOT NULL,
  mood_level SMALLINT NOT NULL CHECK (mood_level BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, mood_date)
);

CREATE INDEX idx_mood_user_date ON mood_entries (user_id, mood_date DESC);


-- ============================================================
-- 13. BLACKLIST (黑名单)
-- ============================================================
CREATE TABLE blacklist (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, blocked_id)
);


-- ============================================================
-- 14. WHEEL SPINS (命运转盘)
-- ============================================================
CREATE TABLE wheel_spins (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spin_date  DATE NOT NULL,
  spin_count SMALLINT NOT NULL DEFAULT 1,    -- max 2 per day
  result_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, spin_date, spin_count)
);

CREATE INDEX idx_wheel_user_date ON wheel_spins (user_id, spin_date);


-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- HELPER VIEW: Unread count per conversation
-- ============================================================
CREATE VIEW v_unread_counts AS
SELECT
  c.id AS conversation_id,
  c.user_a,
  c.user_b,
  COUNT(*) FILTER (WHERE m.read_at IS NULL AND m.sender_id != c.user_a) AS unread_for_a,
  COUNT(*) FILTER (WHERE m.read_at IS NULL AND m.sender_id != c.user_b) AS unread_for_b
FROM conversations c
JOIN messages m ON m.conversation_id = c.id AND NOT m.recalled
GROUP BY c.id, c.user_a, c.user_b;
