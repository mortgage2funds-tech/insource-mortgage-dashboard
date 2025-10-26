
# Mortgage Ops — Pro v2 (Supabase, Mobile-First)

This version includes:
- **File Type** (Residential/Commercial) with one-click filters
- **7-stage pipeline** (no accountant stage for now)
- **Color-coded stages**
- **Summary cards**: Active Residential, Active Commercial, Ready to Send
- **Auto next-follow-up** +2 days when stage = Ready to send to banker
- **CSV Import** (bring your existing Excel)

---

## 0) Requirements
- Node.js LTS: https://nodejs.org/en/download (Mac or Windows)
- A free Supabase account: https://supabase.com

---

## 1) Create the database (5 minutes)
In Supabase → **SQL Editor**, run:

```sql
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  name text not null,
  email text,
  phone text,
  lender text,
  file_type text check (file_type in ('Residential','Commercial')) default 'Residential',
  stage text check (stage in (
    'Lead',
    'Docs received',
    'Numbers done',
    'Ready to send to banker',
    'Sent to banker',
    'Decision (Approved/Declined/More Info)',
    'Completed'
  )) default 'Lead',
  next_follow_up date,
  assigned_to text check (assigned_to in ('Rajanpreet','Assistant')) default 'Assistant',
  last_contact date,
  notes text,
  banker_name text,
  banker_email text,
  bank text
);

alter table public.clients enable row level security;

create policy "read clients" on public.clients
for select to authenticated using (true);

create policy "insert clients" on public.clients
for insert to authenticated with check (true);

create policy "update clients" on public.clients
for update to authenticated using (true) with check (true);
```

---

## 2) Get your keys
Supabase → **Settings → API**:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Create `.env.local` in this folder:
```
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

---

## 3) Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

---

## 4) Import your Excel (CSV)
Use the **Import from Excel (CSV)** card.
Headers expected:
```
Client Name, Email, Phone, Lender, File Type, Stage, Next Follow-Up Date, Assigned To, Last Contact Date, Notes, Banker Name, Banker Email, Bank
```

---

## 5) Deploy so your assistant can use it (no installs)
- Go to **vercel.com** → sign in with GitHub or email (free)
- New Project → **Import** this folder
- Add environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploy → share the URL with your assistant

They can open it on Windows; you can open on Samsung and **Add to Home Screen**.

---

## Tips
- Use the top filters: **Assignee**, **File Type**, and **Stage** to focus quickly.
- Mark stage **Ready to send to banker** → system auto-sets **Next Follow-Up** in 2 days.
- Use the three quick buttons (+1/+3/+7 days) inside the edit modal on mobile.

Need login or reminders? We can add magic-link auth and daily emails next.
# insource-mortgage-dashboard
# insource-mortgage-dashboard
# insource-mortgage-dashboard
