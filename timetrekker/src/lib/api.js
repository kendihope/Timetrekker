import { supabase } from "./supabaseClient";

// ---------- Profile & budget profile ----------
export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}
export async function updateProfileRow(userId, fields) {
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) throw error;
}

export async function fetchBudgetProfile(userId) {
  const { data, error } = await supabase.from("budget_profile").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data;
}
export async function updateBudgetProfile(userId, fields) {
  const { error } = await supabase.from("budget_profile").update(fields).eq("user_id", userId);
  if (error) throw error;
}

// ---------- Classes ----------
export async function fetchClasses(userId) {
  const { data, error } = await supabase.from("classes").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return data.map((c) => ({
    id: c.id, subject: c.subject, date: c.class_date, time: c.class_time,
    room: c.room, lecturer: c.lecturer, description: c.description,
  }));
}
export async function insertClass(userId, cls) {
  const { data, error } = await supabase.from("classes").insert({
    user_id: userId, subject: cls.subject, class_date: cls.date, class_time: cls.time,
    room: cls.room, lecturer: cls.lecturer, description: cls.description,
  }).select().single();
  if (error) throw error;
  return data.id;
}
export async function removeClass(id) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Tasks ----------
export async function fetchTasks(userId) {
  const { data, error } = await supabase.from("tasks").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return data.map((t) => ({
    id: t.id, category: t.category, title: t.title, priority: t.priority,
    time: t.task_time, dueDate: t.due_date, recurring: t.recurring, completed: t.completed,
  }));
}
export async function insertTask(userId, task) {
  const { error } = await supabase.from("tasks").insert({
    user_id: userId, category: task.category, title: task.title, priority: task.priority,
    task_time: task.time, due_date: task.dueDate, recurring: task.recurring, completed: false,
  });
  if (error) throw error;
}
export async function updateTaskRow(id, fields) {
  const mapped = {};
  if ("completed" in fields) mapped.completed = fields.completed;
  const { error } = await supabase.from("tasks").update(mapped).eq("id", id);
  if (error) throw error;
}
export async function removeTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Assignments ----------
export async function fetchAssignments(userId) {
  const { data, error } = await supabase.from("assignments").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return data.map((a) => ({
    id: a.id, classId: a.class_id, title: a.title, description: a.description,
    dueDate: a.due_date, completed: a.completed, progress: a.progress,
  }));
}
export async function insertAssignment(userId, classId, a) {
  const { error } = await supabase.from("assignments").insert({
    user_id: userId, class_id: classId, title: a.title, description: a.description,
    due_date: a.dueDate, completed: false, progress: 0,
  });
  if (error) throw error;
}
export async function updateAssignmentRow(id, fields) {
  const { error } = await supabase.from("assignments").update(fields).eq("id", id);
  if (error) throw error;
}
export async function removeAssignment(id) {
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Expenses ----------
export async function fetchExpenses(userId) {
  const { data, error } = await supabase.from("expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false });
  if (error) throw error;
  return data.map((e) => ({ id: e.id, date: e.expense_date, category: e.category, amount: Number(e.amount), note: e.note }));
}
export async function insertExpense(userId, e) {
  const { error } = await supabase.from("expenses").insert({
    user_id: userId, expense_date: e.date, category: e.category, amount: e.amount, note: e.note,
  });
  if (error) throw error;
}
export async function removeExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Goals ----------
export async function fetchGoals(userId) {
  const { data, error } = await supabase.from("goals").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return data.map((g) => ({ id: g.id, name: g.name, target: Number(g.target), saved: Number(g.saved) }));
}
export async function insertGoal(userId, g) {
  const { error } = await supabase.from("goals").insert({ user_id: userId, name: g.name, target: g.target, saved: g.saved || 0 });
  if (error) throw error;
}
export async function updateGoalRow(id, fields) {
  const { error } = await supabase.from("goals").update(fields).eq("id", id);
  if (error) throw error;
}
export async function removeGoal(id) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Resources (files go to Supabase Storage, private per user) ----------
export async function fetchResources(userId) {
  const { data, error } = await supabase.from("resources").select("*").eq("user_id", userId).order("uploaded_date", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id, category: r.category, name: r.name, type: r.file_type,
    size: r.file_size, storagePath: r.storage_path, uploadedDate: r.uploaded_date,
  }));
}
export async function uploadResource(userId, { category, file }) {
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("resources").upload(path, file);
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("resources").insert({
    user_id: userId, category, name: file.name, file_type: file.type, file_size: file.size, storage_path: path,
  });
  if (error) throw error;
}
export async function getResourceSignedUrl(storagePath) {
  const { data, error } = await supabase.storage.from("resources").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function removeResource(id, storagePath) {
  await supabase.storage.from("resources").remove([storagePath]);
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Full data wipe (keeps the account, clears everything else) ----------
export async function wipeAllUserData(userId) {
  const { data: files } = await supabase.storage.from("resources").list(userId);
  if (files && files.length) {
    await supabase.storage.from("resources").remove(files.map((f) => `${userId}/${f.name}`));
  }
  await Promise.all([
    supabase.from("resources").delete().eq("user_id", userId),
    supabase.from("goals").delete().eq("user_id", userId),
    supabase.from("expenses").delete().eq("user_id", userId),
    supabase.from("assignments").delete().eq("user_id", userId),
    supabase.from("tasks").delete().eq("user_id", userId),
    supabase.from("classes").delete().eq("user_id", userId),
  ]);
  await supabase.from("budget_profile").update({ total_budget: 0, income: 0, savings: 0 }).eq("user_id", userId);
}

