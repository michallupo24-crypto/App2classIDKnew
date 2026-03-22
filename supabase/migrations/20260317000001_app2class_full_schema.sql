-- Exam proposals for AI exam planner
CREATE TABLE IF NOT EXISTS exam_proposals (
  id uuid default gen_random_uuid() primary key,
  subject text not null,
  grade text not null,
  semester text default 'second',
  exam_number int default 1,
  proposed_dates text[] default '{}',
  ai_reasoning text,
  status text default 'pending_teachers',
  teacher_responses jsonb default '[]',
  coordinator_response jsonb,
  created_by uuid references auth.users(id),
  deadline date,
  school_id uuid,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS exam_proposal_messages (
  id uuid default gen_random_uuid() primary key,
  proposal_id uuid references exam_proposals(id) on delete cascade,
  sender_name text,
  sender_role text,
  content text,
  type text,
  data jsonb,
  created_at timestamptz default now()
);

-- Student flags for counselor
CREATE TABLE IF NOT EXISTS student_flags (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id),
  flagged_by uuid references auth.users(id),
  reason text,
  resolved boolean default false,
  created_at timestamptz default now()
);

-- Counselor cases (encrypted)
CREATE TABLE IF NOT EXISTS counselor_cases (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id),
  counselor_id uuid references auth.users(id),
  status text default 'active',
  notes jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Teacher guidance from counselor
CREATE TABLE IF NOT EXISTS teacher_guidance (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references auth.users(id),
  counselor_id uuid references auth.users(id),
  guidance text,
  is_confidential boolean default true,
  created_at timestamptz default now()
);

-- Absence justifications
CREATE TABLE IF NOT EXISTS absence_justifications (
  id uuid default gen_random_uuid() primary key,
  attendance_id uuid,
  student_id uuid references auth.users(id),
  reason text,
  proof_url text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Live polls
CREATE TABLE IF NOT EXISTS live_polls (
  id uuid default gen_random_uuid() primary key,
  session_id uuid,
  question text,
  options text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Poll responses
CREATE TABLE IF NOT EXISTS live_poll_responses (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references live_polls(id),
  student_id uuid references auth.users(id),
  selected_option text,
  created_at timestamptz default now()
);

-- Gamification stats
CREATE TABLE IF NOT EXISTS gamification_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) unique,
  streak_days int default 0,
  total_points int default 0,
  badges jsonb default '[]',
  last_attendance_date date,
  updated_at timestamptz default now()
);

-- RLS policies
ALTER TABLE exam_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselor_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_stats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read exam proposals
CREATE POLICY "Authenticated can read exam proposals" ON exam_proposals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coordinators can insert exam proposals" ON exam_proposals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow update exam proposals" ON exam_proposals
  FOR UPDATE TO authenticated USING (true);

-- Counselor cases - only counselor can see
CREATE POLICY "Counselor can manage own cases" ON counselor_cases
  FOR ALL TO authenticated USING (counselor_id = auth.uid());

-- Absence justifications
CREATE POLICY "Students can manage own justifications" ON absence_justifications
  FOR ALL TO authenticated USING (student_id = auth.uid());

-- Gamification
CREATE POLICY "Users can read own stats" ON gamification_stats
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own stats" ON gamification_stats
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Function to initialize gamification for new users
CREATE OR REPLACE FUNCTION init_gamification_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gamification_stats (user_id, streak_days, total_points, badges)
  VALUES (NEW.id, 0, 0, '[{"name": "הצטרפות", "icon": "🎉"}]')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_gamification ON profiles;
CREATE TRIGGER on_user_created_gamification
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION init_gamification_stats();
