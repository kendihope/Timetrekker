import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Plus, Bell, Search, Check, Clock, X, Trash2, ChevronRight,
  ChevronDown, Wallet, ListTodo, BookOpen, Layers, Home as HomeIcon,
  User, Shield, BellRing, Camera, Upload, FileText, Download,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "./lib/supabaseClient";
import Auth from "./components/Auth";
import * as api from "./lib/api";
import { subscribeToPush, unsubscribeFromPush, pushSupported } from "./lib/push";

const DONUT_COLORS = ["#3B82F6", "#F59E0B", "#EF4444", "#10B981", "#8B5CF6", "#EC4899"];
const MAX_EMBED_BYTES = 1500000;
const RESOURCE_CATEGORIES = ["Courses", "Work documents", "Assignments"];

const ACCENT = {
  red: { bg: "bg-red-500", text: "text-red-500" },
  blue: { bg: "bg-blue-500", text: "text-blue-500" },
  green: { bg: "bg-green-600", text: "text-green-500" },
  yellow: { bg: "bg-yellow-500", text: "text-yellow-500" },
};

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const categoryStyle = {
  School: { bg: "bg-blue-600" },
  Work: { bg: "bg-amber-800" },
  Social: { bg: "bg-zinc-600" },
};

const priorityStyle = {
  High: "bg-red-500",
  Medium: "bg-amber-500",
  Low: "bg-green-600",
};

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "classes", label: "Classes", icon: BookOpen },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "budget", label: "Budget", icon: Wallet },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function withinPeriod(dateStr, period) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  if (period === "Daily") return dateStr === isoDate(0);
  if (period === "Weekly") {
    const diffDays = Math.floor((now - d) / 86400000);
    return diffDays >= 0 && diffDays < 7;
  }
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function aggregateByCategory(expenses, period) {
  const filtered = expenses.filter((e) => withinPeriod(e.date, period));
  const map = {};
  filtered.forEach((e) => {
    if (!map[e.category]) map[e.category] = { category: e.category, total: 0, items: [] };
    map[e.category].total += e.amount;
    map[e.category].items.push(e);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function Switch({ on, onToggle, accent }) {
  return (
    <button
      onClick={onToggle}
      className={`w-11 h-6 rounded-full relative overflow-hidden transition flex-shrink-0 ${on ? accent.bg : "bg-neutral-700"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export default function LifeScheduleApp() {
  const [session, setSession] = useState(null); // undefined-ish: null = checking, false = signed out, object = signed in
  const [data, setData] = useState(null);
  const [screen, setScreen] = useState("home");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedGoalId, setSelectedGoalId] = useState(null);

  // ---- Auth: check for an existing session, and keep listening for changes ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session || false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- Once signed in, load everything for this user in parallel ----
  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    (async () => {
      try {
        const [profile, budgetProfile, classes, tasks, assignments, expenses, goals, resources] = await Promise.all([
          api.fetchProfile(userId),
          api.fetchBudgetProfile(userId),
          api.fetchClasses(userId),
          api.fetchTasks(userId),
          api.fetchAssignments(userId),
          api.fetchExpenses(userId),
          api.fetchGoals(userId),
          api.fetchResources(userId),
        ]);
        setData({
          userName: profile.user_name || session.user.email.split("@")[0],
          userEmail: profile.user_email || session.user.email,
          profilePhoto: profile.profile_photo,
          themeColor: profile.theme_color,
          useSystemSettings: profile.use_system_settings,
          pushNotificationsEnabled: profile.push_notifications_enabled,
          classes,
          tasks,
          assignments,
          resources,
          budget: {
            totalBudget: Number(budgetProfile.total_budget),
            income: Number(budgetProfile.income),
            savings: Number(budgetProfile.savings),
            goals,
            dailyExpenses: expenses,
          },
        });
      } catch (err) {
        console.error(err);
        showToast("Couldn't load your data — check your connection");
      }
    })();
  }, [session]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const goTo = (s) => {
    setScreen(s);
    setSelectedClassId(null);
  };

  const openClass = (id) => {
    setScreen("classes");
    setSelectedClassId(id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setData(null);
    setScreen("home");
  };

  if (session === null) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400 text-sm">Loading...</div>;
  }
  if (session === false) {
    return <Auth />;
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400 text-sm">
        Loading your schedule...
      </div>
    );
  }

  const userId = session.user.id;
  const accent = ACCENT[data.themeColor] || ACCENT.red;
  const initials = data.userName.split(" ").map((w) => w[0]).join("").slice(0, 2);

  const toggleTask = async (id) => {
    const t = data.tasks.find((x) => x.id === id);
    setData({ ...data, tasks: data.tasks.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)) });
    try { await api.updateTaskRow(id, { completed: !t.completed }); } catch { showToast("Couldn't save that change"); }
  };
  const deleteTask = async (id) => {
    setData({ ...data, tasks: data.tasks.filter((t) => t.id !== id) });
    try { await api.removeTask(id); } catch { showToast("Couldn't delete task"); }
  };
  const deleteClass = async (id) => {
    setData({ ...data, classes: data.classes.filter((c) => c.id !== id), assignments: data.assignments.filter((a) => a.classId !== id) });
    try { await api.removeClass(id); } catch { showToast("Couldn't delete class"); }
  };

  const addClass = async (cls) => {
    setModal(null);
    try {
      const id = await api.insertClass(userId, cls);
      setData({ ...data, classes: [...data.classes, { ...cls, id }] });
      showToast("Class added");
    } catch { showToast("Couldn't add class"); }
  };

  const addTask = async (task) => {
    setModal(null);
    try {
      await api.insertTask(userId, task);
      const tasks = await api.fetchTasks(userId);
      setData({ ...data, tasks });
      showToast("Task added");
    } catch { showToast("Couldn't add task"); }
  };

  const toggleAssignment = async (id) => {
    const a = data.assignments.find((x) => x.id === id);
    setData({ ...data, assignments: data.assignments.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)) });
    try { await api.updateAssignmentRow(id, { completed: !a.completed }); } catch { showToast("Couldn't save that change"); }
  };
  const bumpAssignmentProgress = async (id) => {
    const a = data.assignments.find((x) => x.id === id);
    const nextProgress = a.progress >= 100 ? 0 : Math.min(100, a.progress + 25);
    setData({ ...data, assignments: data.assignments.map((x) => (x.id === id ? { ...x, progress: nextProgress } : x)) });
    try { await api.updateAssignmentRow(id, { progress: nextProgress }); } catch { showToast("Couldn't save progress"); }
  };
  const deleteAssignment = async (id) => {
    setData({ ...data, assignments: data.assignments.filter((a) => a.id !== id) });
    try { await api.removeAssignment(id); } catch { showToast("Couldn't delete assignment"); }
  };
  const addAssignment = async (a) => {
    setModal(null);
    try {
      await api.insertAssignment(userId, selectedClassId, a);
      const assignments = await api.fetchAssignments(userId);
      setData({ ...data, assignments });
      showToast("Assignment added");
    } catch { showToast("Couldn't add assignment"); }
  };

  const addMoney = async (amount) => {
    setModal(null);
    const next = { totalBudget: data.budget.totalBudget + amount, income: data.budget.income + amount };
    setData({ ...data, budget: { ...data.budget, ...next } });
    try { await api.updateBudgetProfile(userId, { total_budget: next.totalBudget, income: next.income }); showToast(`Added Ksh.${amount.toLocaleString()} income`); }
    catch { showToast("Couldn't save that"); }
  };

  const addExpense = async ({ date, category, amount, note }) => {
    setModal(null);
    try {
      await api.insertExpense(userId, { date, category, amount, note });
      const dailyExpenses = await api.fetchExpenses(userId);
      setData({ ...data, budget: { ...data.budget, dailyExpenses } });
      showToast(`Logged Ksh.${amount.toLocaleString()} expense`);
    } catch { showToast("Couldn't log expense"); }
  };

  const deleteExpense = async (id) => {
    setData({ ...data, budget: { ...data.budget, dailyExpenses: data.budget.dailyExpenses.filter((e) => e.id !== id) } });
    try { await api.removeExpense(id); } catch { showToast("Couldn't delete expense"); }
  };

  const addSavings = async (amount) => {
    setModal(null);
    const savings = data.budget.savings + amount;
    setData({ ...data, budget: { ...data.budget, savings } });
    try { await api.updateBudgetProfile(userId, { savings }); showToast(`Added Ksh.${amount.toLocaleString()} to savings`); }
    catch { showToast("Couldn't save that"); }
  };

  const addGoal = async (goal) => {
    setModal(null);
    try {
      await api.insertGoal(userId, goal);
      const goals = await api.fetchGoals(userId);
      setData({ ...data, budget: { ...data.budget, goals } });
      showToast("Goal added");
    } catch { showToast("Couldn't add goal"); }
  };

  const deleteGoal = async (id) => {
    setData({ ...data, budget: { ...data.budget, goals: data.budget.goals.filter((g) => g.id !== id) } });
    try { await api.removeGoal(id); } catch { showToast("Couldn't delete goal"); }
  };

  const addToGoal = async (goalId, amount) => {
    const g = data.budget.goals.find((x) => x.id === goalId);
    const saved = g.saved + amount;
    const savings = data.budget.savings + amount;
    setData({ ...data, budget: { ...data.budget, savings, goals: data.budget.goals.map((x) => (x.id === goalId ? { ...x, saved } : x)) } });
    setModal(null);
    setSelectedGoalId(null);
    try {
      await api.updateGoalRow(goalId, { saved });
      await api.updateBudgetProfile(userId, { savings });
      showToast(`Added Ksh.${amount.toLocaleString()} to goal`);
    } catch { showToast("Couldn't save that"); }
  };

  const setThemeColor = async (color) => {
    setData({ ...data, themeColor: color });
    try { await api.updateProfileRow(userId, { theme_color: color }); } catch { showToast("Couldn't save theme"); }
  };
  const setUseSystemSettings = async (v) => {
    setData({ ...data, useSystemSettings: v });
    try { await api.updateProfileRow(userId, { use_system_settings: v }); } catch { showToast("Couldn't save setting"); }
  };
  const setPushNotifications = async (v) => {
    if (v) {
      try {
        const sub = await subscribeToPush();
        await api.savePushSubscription(userId, sub);
        setData({ ...data, pushNotificationsEnabled: true });
        await api.updateProfileRow(userId, { push_notifications_enabled: true });
        showToast("Notifications enabled");
      } catch (err) {
        showToast(err.message || "Couldn't enable notifications");
      }
    } else {
      try {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await api.removePushSubscription(endpoint);
      } catch {
        // ignore — we still want to flip the preference off locally
      }
      setData({ ...data, pushNotificationsEnabled: false });
      try { await api.updateProfileRow(userId, { push_notifications_enabled: false }); } catch { showToast("Couldn't save setting"); }
    }
  };
  const sendTestNotification = async () => {
    try {
      await api.sendTestPush(userId);
      showToast("Test notification sent");
    } catch {
      showToast("Couldn't send test notification");
    }
  };
  const updateProfile = async (fields) => {
    setData({ ...data, ...fields });
    try {
      await api.updateProfileRow(userId, {
        ...("userName" in fields ? { user_name: fields.userName } : {}),
        ...("userEmail" in fields ? { user_email: fields.userEmail } : {}),
        ...("profilePhoto" in fields ? { profile_photo: fields.profilePhoto } : {}),
      });
      showToast("Profile updated");
    } catch { showToast("Couldn't update profile"); }
  };
  const resetAllData = async () => {
    try {
      await api.wipeAllUserData(userId);
      setData({ ...data, classes: [], tasks: [], assignments: [], resources: [], budget: { totalBudget: 0, income: 0, savings: 0, goals: [], dailyExpenses: [] } });
      showToast("All data cleared");
    } catch { showToast("Couldn't clear data"); }
  };

  const addResource = async ({ category, file }) => {
    setModal(null);
    try {
      await api.uploadResource(userId, { category, file });
      const resources = await api.fetchResources(userId);
      setData({ ...data, resources });
      showToast("Document uploaded");
    } catch (err) {
      showToast(err.message?.includes("exceeded") ? "File too large for storage" : "Couldn't upload file");
    }
  };
  const deleteResource = async (id) => {
    const r = data.resources.find((x) => x.id === id);
    setData({ ...data, resources: data.resources.filter((x) => x.id !== id) });
    try { await api.removeResource(id, r.storagePath); } catch { showToast("Couldn't delete document"); }
  };

  const sortedClasses = [...data.classes].sort((a, b) => a.time.localeCompare(b.time));
  const highlightId = sortedClasses[0]?.id;
  const todaysTasks = data.tasks.filter((t) => t.category === "Social" || t.dueDate === "").slice(0, 4);
  const openAssignments = data.assignments.filter((a) => !a.completed).slice(0, 4);
  const counts = {
    School: data.tasks.filter((t) => t.category === "School").length,
    Work: data.tasks.filter((t) => t.category === "Work").length,
    Social: data.tasks.filter((t) => t.category === "Social").length,
  };
  const totalSpending = data.budget.dailyExpenses.reduce((s, e) => s + e.amount, 0);
  const selectedClass = data.classes.find((c) => c.id === selectedClassId);
  const classAssignments = data.assignments.filter((a) => a.classId === selectedClassId);
  const existingCategories = [...new Set(data.budget.dailyExpenses.map((e) => e.category))];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="w-full max-w-sm mx-auto min-h-screen bg-black relative pb-20">
        {screen === "home" && (
          <Home
            data={data}
            initials={initials}
            openAssignments={openAssignments}
            todaysTasks={todaysTasks}
            toggleTask={toggleTask}
            onToggleAssignment={toggleAssignment}
            onBumpAssignment={bumpAssignmentProgress}
            openAddAssignment={() => setModal("addAssignment")}
            goTo={goTo}
            openClass={openClass}
            showToast={showToast}
            accent={accent}
          />
        )}
        {screen === "classes" && !selectedClassId && (
          <ClassesScreen
            classes={sortedClasses}
            highlightId={highlightId}
            goHome={() => goTo("home")}
            openAdd={() => setModal("addClass")}
            onDelete={deleteClass}
            onSelect={setSelectedClassId}
          />
        )}
        {screen === "classes" && selectedClassId && selectedClass && (
          <ClassDetail
            cls={selectedClass}
            assignments={classAssignments}
            goBack={() => setSelectedClassId(null)}
            openAdd={() => setModal("addAssignment")}
            onToggle={toggleAssignment}
            onDelete={deleteAssignment}
            accent={accent}
          />
        )}
        {screen === "tasks" && (
          <TasksScreen
            tasks={data.tasks}
            counts={counts}
            goHome={() => goTo("home")}
            openAdd={() => setModal("addTask")}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}
        {screen === "budget" && (
          <BudgetScreen
            budget={data.budget}
            totalSpending={totalSpending}
            goHome={() => goTo("home")}
            openAddMoney={() => setModal("addMoney")}
            openAddExpense={() => setModal("addExpense")}
            onDeleteExpense={deleteExpense}
            openAddSavings={() => setModal("addSavings")}
            openAddGoal={() => setModal("addGoal")}
            onDeleteGoal={deleteGoal}
            onAddToGoal={(id) => { setSelectedGoalId(id); setModal("addToGoal"); }}
            accent={accent}
          />
        )}
        {screen === "resources" && (
          <ResourcesScreen
            resources={data.resources}
            goHome={() => goTo("home")}
            openAdd={() => setModal("addResource")}
            onDelete={deleteResource}
          />
        )}
        {screen === "profile" && (
          <ProfileScreen
            data={data}
            goHome={() => goTo("home")}
            setThemeColor={setThemeColor}
            setUseSystemSettings={setUseSystemSettings}
            setPushNotifications={setPushNotifications}
            onSendTestNotification={sendTestNotification}
            updateProfile={updateProfile}
            resetAllData={resetAllData}
            onLogout={handleLogout}
            showToast={showToast}
            accent={accent}
          />
        )}

        {modal === "addClass" && <AddClassModal onClose={() => setModal(null)} onSave={addClass} accent={accent} />}
        {modal === "addTask" && <AddTaskModal onClose={() => setModal(null)} onSave={addTask} accent={accent} />}
        {modal === "addAssignment" && <AddAssignmentModal onClose={() => setModal(null)} onSave={addAssignment} accent={accent} />}
        {modal === "addMoney" && <AmountModal title="Add money" actionLabel="Add to income" onClose={() => setModal(null)} onSave={addMoney} accent={accent} />}
        {modal === "addExpense" && <AddExpenseModal onClose={() => setModal(null)} onSave={addExpense} existing={existingCategories} accent={accent} />}
        {modal === "addSavings" && <AmountModal title="Add to savings" actionLabel="Add to savings" onClose={() => setModal(null)} onSave={addSavings} accent={accent} />}
        {modal === "addGoal" && <AddGoalModal onClose={() => setModal(null)} onSave={addGoal} accent={accent} />}
        {modal === "addToGoal" && <AmountModal title="Add to goal" actionLabel="Add funds" onClose={() => { setModal(null); setSelectedGoalId(null); }} onSave={(amt) => addToGoal(selectedGoalId, amt)} accent={accent} />}
        {modal === "addResource" && <AddResourceModal onClose={() => setModal(null)} onSave={addResource} accent={accent} />}

        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white text-black text-sm font-medium px-4 py-2 rounded-full shadow-lg z-50 max-w-[85%] text-center">
            {toast}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-900 flex justify-around py-2 z-40">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = screen === item.key;
          return (
            <button key={item.key} onClick={() => goTo(item.key)} className="flex flex-col items-center gap-1 px-3 py-1">
              <Icon size={19} className={active ? accent.text : "text-neutral-500"} />
              <span className={`text-[10px] ${active ? accent.text : "text-neutral-500"}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
function Home({ data, initials, openAssignments, todaysTasks, toggleTask, onToggleAssignment, onBumpAssignment, openAddAssignment, goTo, openClass, showToast, accent }) {
  const [query, setQuery] = useState("");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const q = query.trim().toLowerCase();
  const results = q
    ? [
        ...data.classes.filter((c) => c.subject.toLowerCase().includes(q)).map((c) => ({ type: "Class", id: c.id, label: c.subject })),
        ...data.tasks.filter((t) => t.title.toLowerCase().includes(q)).map((t) => ({ type: "Task", id: t.id, label: t.title })),
        ...data.assignments.filter((a) => a.title.toLowerCase().includes(q)).map((a) => ({ type: "Assignment", id: a.id, label: a.title, classId: a.classId })),
      ]
    : [];

  const handleResultClick = (r) => {
    setQuery("");
    if (r.type === "Class") openClass(r.id);
    else if (r.type === "Assignment") openClass(r.classId);
    else goTo("tasks");
  };

  const navButtons = [
    { label: "Classes", action: () => goTo("classes"), icon: BookOpen },
    { label: "Resources", action: () => goTo("resources"), icon: Layers },
    { label: "To-do list", action: () => goTo("tasks"), icon: ListTodo },
    { label: "Budget", action: () => goTo("budget"), icon: Wallet },
  ];

  return (
    <div className="px-5 pt-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => goTo("profile")} className="w-11 h-11 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-semibold overflow-hidden">
            {data.profilePhoto ? <img src={data.profilePhoto} alt="" className="w-full h-full object-cover" /> : initials}
          </button>
          <div>
            <p className="text-neutral-400 text-sm leading-none">{greeting}</p>
            <p className="font-semibold leading-tight mt-0.5 text-lg">{data.userName}</p>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
          <Bell size={18} className="text-black" />
        </button>
      </div>

      <div className="relative mb-6">
        <div className="flex items-center gap-2 bg-neutral-900 rounded-full px-4 py-3">
          <Search size={18} className="text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, assignments, classes"
            className="bg-transparent outline-none text-sm w-full placeholder-neutral-500"
          />
          {query && (
            <button onClick={() => setQuery("")}><X size={15} className="text-neutral-500" /></button>
          )}
        </div>
        {q && (
          <div className="absolute left-0 right-0 mt-2 bg-neutral-900 rounded-2xl overflow-hidden z-30 shadow-xl">
            {results.length === 0 && <p className="text-sm text-neutral-500 px-4 py-3">No matches for "{query}"</p>}
            {results.slice(0, 8).map((r) => (
              <button
                key={r.type + r.id}
                onClick={() => handleResultClick(r)}
                className="w-full text-left px-4 py-3 flex items-center justify-between border-b border-neutral-800 last:border-none hover:bg-neutral-800"
              >
                <span className="text-sm">{r.label}</span>
                <span className="text-xs text-neutral-500">{r.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {navButtons.map((b) => (
          <button
            key={b.label}
            onClick={b.action}
            className={`${accent.bg} rounded-full py-4 font-semibold text-sm active:opacity-80 transition`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="bg-neutral-300 text-black rounded-3xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Assignments due</h2>
          <button onClick={openAddAssignment} className="w-7 h-7 rounded-full bg-black flex items-center justify-center">
            <Plus size={15} className="text-white" />
          </button>
        </div>
        {openAssignments.length === 0 && <p className="text-sm text-neutral-600">Nothing due — you're clear.</p>}
        <div className="space-y-4">
          {openAssignments.map((a) => (
            <div key={a.id}>
              <div className="flex items-center gap-3 mb-1.5">
                <button onClick={() => onToggleAssignment(a.id)} className="flex-shrink-0">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${a.completed ? "bg-black border-black" : "border-neutral-500"}`}>
                    {a.completed && <Check size={12} className="text-white" />}
                  </span>
                </button>
                <span className={`text-sm font-medium flex-1 ${a.completed ? "line-through text-neutral-500" : ""}`}>{a.title}</span>
                <span className="text-xs text-neutral-600">{a.progress || 0}%</span>
              </div>
              <button onClick={() => onBumpAssignment(a.id)} className="w-full h-1.5 bg-neutral-400/50 rounded-full overflow-hidden ml-8" style={{ width: "calc(100% - 2rem)" }}>
                <div className={`h-full ${accent.bg}`} style={{ width: `${a.progress || 0}%` }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Today's Tasks</h2>
        <button onClick={() => goTo("tasks")} className="text-neutral-400 text-sm">See more</button>
      </div>
      <div className="space-y-3">
        {todaysTasks.map((t) => (
          <div key={t.id} className="bg-neutral-300 text-black rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{t.title}</p>
              {t.time && <p className="text-xs text-neutral-600 mt-0.5">{t.time}</p>}
            </div>
            <button
              onClick={() => toggleTask(t.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${t.completed ? "bg-black" : "bg-neutral-400"}`}
            >
              {t.completed && <Check size={15} className="text-white" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= HEADER =================
function ScreenHeader({ title, goHome, openAdd, showBell, onBack }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 mb-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack || goHome}><ArrowLeft size={22} /></button>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {openAdd && (
          <button onClick={openAdd} className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
            <Plus size={18} className="text-black" />
          </button>
        )}
        {showBell && (
          <button className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
            <Bell size={16} className="text-black" />
          </button>
        )}
      </div>
    </div>
  );
}

// ================= CLASSES =================
function ClassesScreen({ classes, highlightId, goHome, openAdd, onDelete, onSelect }) {
  return (
    <div>
      <ScreenHeader title="Today Classes" goHome={goHome} openAdd={openAdd} showBell />
      <div className="px-5 space-y-4">
        {classes.length === 0 && <p className="text-neutral-500 text-sm text-center mt-10">No classes yet. Tap + to add one.</p>}
        {classes.map((c) => {
          const isHighlight = c.id === highlightId;
          return (
            <div
              key={c.id}
              className={`rounded-3xl p-5 relative cursor-pointer ${isHighlight ? "bg-blue-600" : "bg-neutral-100 text-black"}`}
              onClick={() => onSelect(c.id)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                className={`absolute top-4 right-4 ${isHighlight ? "text-white/70" : "text-neutral-400"}`}
              >
                <Trash2 size={16} />
              </button>
              <h3 className={`text-lg font-bold pr-6 ${isHighlight ? "text-white" : "text-black"}`}>{c.subject}</h3>
              {isHighlight ? (
                <>
                  <p className="text-sm text-white/90 mt-1">{c.date} {c.time}</p>
                  {c.room && <p className="text-sm text-white/80 mt-2">{c.room}</p>}
                  {c.lecturer && <p className="font-semibold mt-4">Lecturer- {c.lecturer}</p>}
                </>
              ) : (
                <>
                  <p className="text-sm mt-1">{c.time}</p>
                  {c.room && <p className="text-sm text-neutral-600">{c.room}</p>}
                  {c.lecturer && <p className="text-sm text-neutral-600 mt-1">Lecturer- {c.lecturer}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassDetail({ cls, assignments, goBack, openAdd, onToggle, onDelete, accent }) {
  return (
    <div>
      <ScreenHeader title="Class" onBack={goBack} goHome={goBack} />
      <div className="px-5">
        <div className="bg-neutral-100 text-black rounded-3xl p-5 mb-6">
          <h2 className="text-2xl font-bold">{cls.subject}</h2>
          <p className="text-sm text-neutral-600 mt-1">{cls.time} {cls.room && `\u00b7 ${cls.room}`}</p>
          {cls.description && <p className="text-sm text-neutral-700 mt-4 leading-relaxed">{cls.description}</p>}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-lg font-bold ${accent.text}`}>Assignments</h3>
          <button onClick={openAdd} className="text-sm text-neutral-400">+ Add</button>
        </div>
        <div className="space-y-3 mb-6">
          {assignments.length === 0 && <p className="text-neutral-500 text-sm">No assignments for this class yet.</p>}
          {assignments.map((a) => (
            <div key={a.id} className="bg-neutral-900 rounded-2xl px-4 py-3 flex items-center justify-between">
              <button onClick={() => onToggle(a.id)} className="flex items-center gap-3 text-left flex-1">
                <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${a.completed ? "bg-white border-white" : "border-neutral-500"}`}>
                  {a.completed && <Check size={12} className="text-black" />}
                </span>
                <span className={`text-sm font-medium ${a.completed ? "line-through text-neutral-500" : ""}`}>{a.title}</span>
              </button>
              <button onClick={() => onDelete(a.id)} className="text-neutral-600"><X size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={openAdd} className={`w-full ${accent.bg} rounded-full py-3 font-semibold`}>Add assignment</button>
      </div>
    </div>
  );
}

// ================= TASKS =================
function TasksScreen({ tasks, counts, goHome, openAdd, onToggle, onDelete }) {
  const [filter, setFilter] = useState("All");
  const filteredTasks = filter === "All" ? tasks : tasks.filter((t) => t.category === filter);
  const ongoing = filteredTasks.filter((t) => !t.completed);
  const done = filteredTasks.filter((t) => t.completed);

  return (
    <div>
      <ScreenHeader title="Tasks" goHome={goHome} openAdd={openAdd} />
      <div className="px-5">
        <div className="grid grid-cols-2 gap-3 mb-3">
          {["School", "Work", "Social"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? "All" : cat)}
              className={`${categoryStyle[cat].bg} rounded-2xl p-4 text-left ${filter === cat ? "ring-2 ring-white" : ""}`}
            >
              <p className="text-lg font-bold">{cat}</p>
              <p className="text-sm text-white/80">{counts[cat]} tasks</p>
            </button>
          ))}
        </div>
        {filter !== "All" && (
          <button onClick={() => setFilter("All")} className="text-sm text-neutral-400 mb-6 underline">
            Clear filter ({filter})
          </button>
        )}
        {filter === "All" && <div className="mb-6" />}

        <h2 className="text-xl font-bold mb-3">Ongoing</h2>
        <div className="space-y-3 mb-6">
          {ongoing.length === 0 && <p className="text-neutral-500 text-sm">Nothing ongoing.</p>}
          {ongoing.map((t) => (
            <div key={t.id} className="bg-neutral-900 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`${priorityStyle[t.priority]} text-xs font-semibold px-3 py-1 rounded-full`}>{t.priority}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => onToggle(t.id)} className="text-xs text-neutral-400 border border-neutral-700 rounded-full px-3 py-1">Done</button>
                  <button onClick={() => onDelete(t.id)} className="text-neutral-500"><X size={16} /></button>
                </div>
              </div>
              <p className="font-bold text-lg">{t.title}</p>
              {t.time && (
                <p className="text-sm text-neutral-400 flex items-center gap-1 mt-1"><Clock size={13} /> {t.time}</p>
              )}
              {t.dueDate && <p className="text-sm text-neutral-500 mt-2">Due date {t.dueDate}</p>}
              {t.recurring && <p className="text-sm text-neutral-500 mt-2">{t.recurring}</p>}
            </div>
          ))}
        </div>

        {done.length > 0 && (
          <>
            <h2 className="text-xl font-bold mb-3 text-neutral-500">Completed</h2>
            <div className="space-y-3">
              {done.map((t) => (
                <div key={t.id} className="bg-neutral-900/50 rounded-2xl p-4 flex items-center justify-between">
                  <p className="text-sm text-neutral-500 line-through">{t.title}</p>
                  <button onClick={() => onToggle(t.id)} className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center">
                    <Check size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ================= BUDGET =================
function BudgetScreen({ budget, totalSpending, goHome, openAddMoney, openAddExpense, onDeleteExpense, openAddSavings, openAddGoal, onDeleteGoal, onAddToGoal, accent }) {
  const [tab, setTab] = useState("Overview");

  return (
    <div>
      <ScreenHeader title="Budget" goHome={goHome} openAdd={tab === "Goals" ? openAddGoal : openAddExpense} />
      <div className="px-5">
        <div className="flex gap-2 mb-6 bg-neutral-900 rounded-full p-1 w-fit">
          {["Overview", "Expenses", "Goals"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === t ? "bg-white text-black" : "text-neutral-400"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <OverviewPanel budget={budget} totalSpending={totalSpending} openAddMoney={openAddMoney} openAddExpense={openAddExpense} onDeleteExpense={onDeleteExpense} accent={accent} />
        )}
        {tab === "Expenses" && <ExpensesPanel budget={budget} onDeleteExpense={onDeleteExpense} accent={accent} />}
        {tab === "Goals" && <GoalsPanel budget={budget} openAddSavings={openAddSavings} onDeleteGoal={onDeleteGoal} onAddToGoal={onAddToGoal} accent={accent} />}
      </div>
    </div>
  );
}

function OverviewPanel({ budget, totalSpending, openAddMoney, openAddExpense, onDeleteExpense, accent }) {
  const [period, setPeriod] = useState("Weekly");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const rows = aggregateByCategory(budget.dailyExpenses, period);
  const periodTotal = rows.reduce((s, r) => s + r.total, 0);
  const remaining = budget.totalBudget - totalSpending;

  return (
    <div>
      <div className="bg-lime-300 text-black rounded-3xl p-5 mb-6">
        <p className="text-center text-sm text-neutral-700">My budget</p>
        <p className="text-center text-3xl font-bold mb-4">Ksh. {budget.totalBudget.toLocaleString()}</p>
        <div className="flex gap-3 mb-4">
          <button onClick={openAddMoney} className="flex-1 bg-green-700 text-white rounded-full py-2 text-sm font-semibold">Add money</button>
          <button onClick={openAddExpense} className="flex-1 bg-green-700 text-white rounded-full py-2 text-sm font-semibold">Add spending</button>
        </div>
        <p className="font-semibold text-sm mb-2">Budget overview</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-3">
            <p className="italic font-semibold">Income</p>
            <p className="italic text-sm">Ksh.{budget.income.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl p-3">
            <p className="italic font-semibold">Spending</p>
            <p className="italic text-sm">Ksh.{totalSpending.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {["Daily", "Weekly", "Monthly"].map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setExpandedCategory(null); }}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${period === p ? accent.bg : "bg-neutral-900 text-neutral-400"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between mb-2 text-sm text-neutral-400 px-1">
        <p>{period} spending</p>
        <p>Remaining: Ksh.{remaining.toLocaleString()}</p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="text-neutral-500 text-sm">No expenses logged for this period.</p>}
        {rows.map((r) => {
          const expanded = expandedCategory === r.category;
          return (
            <div key={r.category} className="bg-neutral-900 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedCategory(expanded ? null : r.category)}
                className="w-full flex items-center justify-between px-4 py-4"
              >
                <p className="font-semibold text-sm">{r.category}</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">Ksh.{r.total.toLocaleString()}</p>
                  <ChevronDown size={16} className={`text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {expanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-neutral-800 pt-3">
                  {r.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-neutral-300">{it.note || "No note"}</p>
                        <p className="text-xs text-neutral-500">{it.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-neutral-300">Ksh.{it.amount.toLocaleString()}</p>
                        <button onClick={() => onDeleteExpense(it.id)} className="text-neutral-600"><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {rows.length > 0 && (
          <div className="flex items-center justify-between px-1 pt-1 text-sm text-neutral-500">
            <p>Total</p>
            <p>Ksh.{periodTotal.toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpensesPanel({ budget, onDeleteExpense, accent }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthName = now.toLocaleString("default", { month: "long" });
  const [selectedDate, setSelectedDate] = useState(isoDate(0));

  const dayExpenses = budget.dailyExpenses.filter((e) => e.date === selectedDate);
  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);

  const monthlyRows = aggregateByCategory(budget.dailyExpenses, "Monthly");
  const chartData = monthlyRows.map((r) => ({ name: r.category, value: r.total }));

  const dateForDay = (day) => {
    const d = new Date(year, month, day);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div>
      <p className="text-sm text-neutral-400 mb-2">{monthName} {year}</p>
      <div className="bg-neutral-900 rounded-3xl p-4 mb-4">
        <div className="grid grid-cols-7 gap-y-2 text-center text-xs text-neutral-500 mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={"e" + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = dateForDay(day);
            const isToday = dateStr === isoDate(0);
            const isSelected = dateStr === selectedDate;
            const hasSpend = budget.dailyExpenses.some((e) => e.date === dateStr);
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`w-7 h-7 flex flex-col items-center justify-center rounded-full mx-auto relative ${
                  isSelected ? `${accent.bg} font-semibold` : isToday ? "border border-white" : "text-neutral-300"
                }`}
              >
                {day}
                {hasSpend && !isSelected && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-lime-300" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-neutral-900 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">{selectedDate === isoDate(0) ? "Today" : selectedDate}</p>
          <p className="text-sm text-neutral-400">Ksh.{dayTotal.toLocaleString()}</p>
        </div>
        {dayExpenses.length === 0 && <p className="text-sm text-neutral-500">No expenses logged for this day.</p>}
        <div className="space-y-2">
          {dayExpenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <div>
                <p>{e.category}</p>
                {e.note && <p className="text-xs text-neutral-500">{e.note}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p>Ksh.{e.amount.toLocaleString()}</p>
                <button onClick={() => onDeleteExpense(e.id)} className="text-neutral-600"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="font-semibold mb-2">Analytics — {monthName}</p>
      <div className="bg-neutral-900 rounded-3xl p-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-10">No expenses logged this month yet.</p>
        ) : (
          <>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {chartData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `Ksh.${Number(v).toLocaleString()}`}
                    contentStyle={{ background: "#171717", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {chartData.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  {c.name} · Ksh.{c.value.toLocaleString()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GoalsPanel({ budget, openAddSavings, onDeleteGoal, onAddToGoal, accent }) {
  return (
    <div>
      <div className="bg-neutral-900 rounded-3xl p-5 mb-6">
        <p className="text-sm text-neutral-400">Closer to your goals today?</p>
        <p className="text-xs text-neutral-500 mb-1">Total savings</p>
        <p className="text-3xl font-bold mb-4">Ksh. {budget.savings.toLocaleString()}</p>
        <button onClick={openAddSavings} className={`${accent.bg} rounded-full px-5 py-2 text-sm font-semibold`}>Add to savings</button>
      </div>

      <p className="font-semibold mb-3">Your active goals</p>
      <div className="space-y-3">
        {budget.goals.map((g) => {
          const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
          return (
            <div key={g.id} className="bg-neutral-900 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm">{g.name}</p>
                <button onClick={() => onDeleteGoal(g.id)} className="text-neutral-600"><X size={15} /></button>
              </div>
              <p className="text-xs text-neutral-500 mb-2">Ksh.{g.saved.toLocaleString()} of Ksh.{g.target.toLocaleString()}</p>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-lime-300" style={{ width: `${pct}%` }} />
              </div>
              <button onClick={() => onAddToGoal(g.id)} className={`text-xs font-semibold ${accent.text}`}>+ Add funds</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================= RESOURCES =================
function ResourceViewer({ resource, onBack }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);

  useEffect(() => {
    setSignedUrl(null);
    setTextContent(null);
    setLoadError(false);
    setEmbedFailed(false);
    (async () => {
      try {
        const url = await api.getResourceSignedUrl(resource.storagePath);
        setSignedUrl(url);
        if (resource.type?.startsWith("text/")) {
          const res = await fetch(url);
          setTextContent(await res.text());
        }
      } catch {
        setLoadError(true);
      }
    })();
  }, [resource.id]);

  const openInNewTab = () => {
    if (!signedUrl) return;
    const win = window.open(signedUrl, "_blank");
    if (!win) setEmbedFailed(true);
  };

  const isPreviewable = resource.type?.startsWith("image/") || resource.type === "application/pdf";

  const renderPreview = () => {
    if (loadError) {
      return (
        <div className="text-center mt-16 px-4">
          <FileText size={32} className="mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-400 text-sm">Couldn't load this file. Try again in a moment.</p>
        </div>
      );
    }
    if (resource.type?.startsWith("text/")) {
      if (textContent === null) return <p className="text-sm text-neutral-500 text-center mt-16">Loading...</p>;
      return <pre className="whitespace-pre-wrap text-sm bg-neutral-900 p-4 rounded-2xl leading-relaxed">{textContent}</pre>;
    }
    if (!signedUrl) {
      return <p className="text-sm text-neutral-500 text-center mt-16">Preparing preview...</p>;
    }
    if (!isPreviewable) {
      return (
        <div className="text-center mt-16 px-4">
          <FileText size={32} className="mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-400 text-sm">Preview isn't available for this file type. Use download instead.</p>
        </div>
      );
    }
    return (
      <div>
        <button onClick={openInNewTab} className="w-full bg-white text-black rounded-full py-3 font-semibold mb-4">
          Open in new tab to read
        </button>
        {embedFailed && (
          <p className="text-xs text-amber-500 mb-4 text-center">
            Your browser blocked the popup — allow popups for this site, or use Download below.
          </p>
        )}
        <div className="rounded-2xl overflow-hidden bg-neutral-900 p-2">
          {resource.type.startsWith("image/") && (
            <img src={signedUrl} alt={resource.name} className="w-full rounded-xl" />
          )}
          {resource.type === "application/pdf" && (
            <iframe title={resource.name} src={signedUrl} className="w-full h-[70vh] rounded-xl bg-white" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-6 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack}><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold truncate">{resource.name}</h1>
        </div>
        {signedUrl && (
          <a href={signedUrl} download={resource.name} className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <Download size={16} className="text-black" />
          </a>
        )}
      </div>
      <div className="px-5">{renderPreview()}</div>
    </div>
  );
}

function ResourcesScreen({ resources, goHome, openAdd, onDelete }) {
  const [tab, setTab] = useState("Courses");
  const [viewingId, setViewingId] = useState(null);
  const filtered = resources.filter((r) => r.category === tab);
  const viewing = resources.find((r) => r.id === viewingId);

  if (viewing) {
    return <ResourceViewer resource={viewing} onBack={() => setViewingId(null)} />;
  }

  return (
    <div>
      <ScreenHeader title="Resources" goHome={goHome} openAdd={openAdd} />
      <div className="px-5">
        <div className="flex gap-2 mb-6 bg-neutral-900 rounded-full p-1 w-fit flex-wrap">
          {RESOURCE_CATEGORIES.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap ${tab === t ? "bg-white text-black" : "text-neutral-400"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center mt-16">
            <FileText size={32} className="mx-auto text-neutral-700 mb-3" />
            <p className="text-neutral-500 text-sm">No {tab.toLowerCase()} uploaded yet.</p>
            <button onClick={openAdd} className="text-sm text-neutral-300 mt-2 underline">Upload one</button>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-neutral-900 rounded-2xl p-4 flex items-center gap-3">
              <button onClick={() => setViewingId(r.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-neutral-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-neutral-500">{formatBytes(r.size)} · {r.uploadedDate}</p>
                </div>
              </button>
              <button onClick={() => onDelete(r.id)} className="text-neutral-600"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================= PROFILE / SETTINGS =================
function ProfileScreen({ data, goHome, setThemeColor, setUseSystemSettings, setPushNotifications, onSendTestNotification, updateProfile, resetAllData, onLogout, showToast, accent }) {
  const [tab, setTab] = useState("Profile");
  const [section, setSection] = useState(null); // null | "personalInfo" | "privacy"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(data.userName);
  const [email, setEmail] = useState(data.userEmail);
  const initials = data.userName.split(" ").map((w) => w[0]).join("").slice(0, 2);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_EMBED_BYTES) {
      showToast("Photo too large — try one under 1.5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateProfile({ profilePhoto: reader.result });
    reader.readAsDataURL(file);
  };

  const saveInfo = () => {
    updateProfile({ userName: name, userEmail: email });
    setSection(null);
  };

  return (
    <div>
      <ScreenHeader
        title={section === "personalInfo" ? "Personal information" : section === "privacy" ? "Account privacy" : tab}
        goHome={goHome}
        onBack={section ? () => setSection(null) : undefined}
      />
      <div className="px-5">
        {!section && (
          <div className="flex gap-2 mb-6 bg-neutral-900 rounded-full p-1 w-fit">
            {["Profile", "Settings"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === t ? "bg-white text-black" : "text-neutral-400"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {!section && tab === "Profile" && (
          <div>
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full bg-neutral-700 flex items-center justify-center text-2xl font-semibold mb-3 overflow-hidden">
                {data.profilePhoto ? <img src={data.profilePhoto} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              <p className="font-semibold text-lg">{data.userName}</p>
              <p className="text-sm text-neutral-500">{data.userEmail}</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => setSection("personalInfo")} className="w-full bg-neutral-900 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-3 text-sm font-medium">
                  <User size={17} className="text-neutral-400" />
                  Personal information
                </span>
                <ChevronRight size={16} className="text-neutral-600" />
              </button>
              <button onClick={() => setSection("privacy")} className="w-full bg-neutral-900 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Shield size={17} className="text-neutral-400" />
                  Account privacy
                </span>
                <ChevronRight size={16} className="text-neutral-600" />
              </button>
              <div className="w-full bg-neutral-900 rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <BellRing size={17} className="text-neutral-400" />
                    Push notifications
                  </span>
                  <Switch on={data.pushNotificationsEnabled} onToggle={() => setPushNotifications(!data.pushNotificationsEnabled)} accent={accent} />
                </div>
                {data.pushNotificationsEnabled && (
                  <button onClick={onSendTestNotification} className={`text-xs font-semibold ${accent.text} mt-3`}>
                    Send a test notification
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {section === "personalInfo" && (
          <div>
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full bg-neutral-700 flex items-center justify-center text-2xl font-semibold mb-3 overflow-hidden relative">
                {data.profilePhoto ? <img src={data.profilePhoto} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              <label className={`flex items-center gap-2 text-sm font-semibold ${accent.text} cursor-pointer`}>
                <Camera size={15} /> Change photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <p className="text-xs text-neutral-500 mb-1 px-1">Name</p>
            <input className="w-full bg-neutral-900 rounded-xl px-4 py-3 text-sm outline-none mb-3" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-neutral-500 mb-1 px-1">Email</p>
            <input className="w-full bg-neutral-900 rounded-xl px-4 py-3 text-sm outline-none mb-4" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button onClick={saveInfo} className={`w-full ${accent.bg} rounded-full py-3 font-semibold`}>Save changes</button>
          </div>
        )}

        {section === "privacy" && (
          <div>
            <p className="font-semibold mb-2">Your data</p>
            <p className="text-sm text-neutral-400 leading-relaxed mb-5">
              Everything you add here — classes, tasks, budget entries, goals, and uploaded documents — is stored privately for your account only. It is never shared with other users or third parties.
            </p>
            <p className="font-semibold mb-2">Your rights</p>
            <ul className="text-sm text-neutral-400 leading-relaxed mb-5 list-disc pl-5 space-y-1">
              <li>Access everything you've stored at any time within the app.</li>
              <li>Edit or delete individual entries directly from their screens.</li>
              <li>Request full deletion of all stored data at any time, below.</li>
            </ul>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="w-full bg-red-900/40 text-red-400 rounded-full py-3 font-semibold">
                Delete all my data
              </button>
            ) : (
              <div className="bg-neutral-900 rounded-2xl p-4">
                <p className="text-sm mb-3">This permanently erases everything and resets the app. Are you sure?</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-neutral-800 rounded-full py-2 text-sm font-semibold">Cancel</button>
                  <button onClick={() => { resetAllData(); setConfirmDelete(false); setSection(null); }} className="flex-1 bg-red-600 rounded-full py-2 text-sm font-semibold">Confirm delete</button>
                </div>
              </div>
            )}
          </div>
        )}

        {!section && tab === "Settings" && (
          <div>
            <p className="font-semibold mb-3">Color themes</p>
            <div className="flex gap-4 mb-6">
              {Object.entries(ACCENT).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setThemeColor(key)}
                  className={`w-10 h-10 rounded-full ${val.bg} flex items-center justify-center ${data.themeColor === key ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                >
                  {data.themeColor === key && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>

            <div className="bg-neutral-900 rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
              <span className="text-sm font-medium">Use system settings</span>
              <Switch on={data.useSystemSettings} onToggle={() => setUseSystemSettings(!data.useSystemSettings)} accent={accent} />
            </div>

            <button onClick={onLogout} className="w-full bg-neutral-900 text-red-400 rounded-full py-3 font-semibold">
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ================= MODALS =================
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-neutral-950 w-full max-w-sm rounded-t-3xl p-5 pb-8 border-t border-neutral-800 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function inputCls() {
  return "w-full bg-neutral-900 rounded-xl px-4 py-3 text-sm outline-none placeholder-neutral-500 mb-3";
}

function AddClassModal({ onClose, onSave, accent }) {
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [description, setDescription] = useState("");

  return (
    <ModalShell title="Add class" onClose={onClose}>
      <input className={inputCls()} placeholder="Subject / class name" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <input className={inputCls()} placeholder="Date (e.g. 19th May)" value={date} onChange={(e) => setDate(e.target.value)} />
      <input className={inputCls()} placeholder="Time (e.g. 8:00Am - 10:00Am)" value={time} onChange={(e) => setTime(e.target.value)} />
      <input className={inputCls()} placeholder="Room / level" value={room} onChange={(e) => setRoom(e.target.value)} />
      <input className={inputCls()} placeholder="Lecturer (optional)" value={lecturer} onChange={(e) => setLecturer(e.target.value)} />
      <textarea className={inputCls()} placeholder="Description (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <button
        disabled={!subject || !time}
        onClick={() => onSave({ subject, date, time, room, lecturer, description })}
        className={`w-full ${accent.bg} disabled:opacity-40 rounded-full py-3 font-semibold mt-1`}
      >
        Save class
      </button>
    </ModalShell>
  );
}

function AddAssignmentModal({ onClose, onSave, accent }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <ModalShell title="Add assignment" onClose={onClose}>
      <input className={inputCls()} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={inputCls()} placeholder="Description (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className={inputCls()} placeholder="Due date (optional)" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <button
        disabled={!title}
        onClick={() => onSave({ title, description, dueDate })}
        className={`w-full ${accent.bg} disabled:opacity-40 rounded-full py-3 font-semibold mt-1`}
      >
        Add assignment
      </button>
    </ModalShell>
  );
}

function AddTaskModal({ onClose, onSave, accent }) {
  const [category, setCategory] = useState("School");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [time, setTime] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <ModalShell title="Add task" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        {["School", "Work", "Social"].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold ${category === c ? categoryStyle[c].bg : "bg-neutral-900 text-neutral-400"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <input className={inputCls()} placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex gap-2 mb-3">
        {["Low", "Medium", "High"].map((p) => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={`flex-1 rounded-full py-2 text-xs font-semibold ${priority === p ? priorityStyle[p] : "bg-neutral-900 text-neutral-400"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <input className={inputCls()} placeholder="Time (optional)" value={time} onChange={(e) => setTime(e.target.value)} />
      <input className={inputCls()} placeholder="Due date (optional)" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <button
        disabled={!title}
        onClick={() => onSave({ category, title, priority, time, dueDate, recurring: "" })}
        className={`w-full ${accent.bg} disabled:opacity-40 rounded-full py-3 font-semibold mt-1`}
      >
        Save task
      </button>
    </ModalShell>
  );
}

function AddExpenseModal({ onClose, onSave, existing, accent }) {
  const [date, setDate] = useState(isoDate(0));
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const n = Number(amount);

  return (
    <ModalShell title="Add spending" onClose={onClose}>
      <input type="date" className={inputCls()} value={date} onChange={(e) => setDate(e.target.value)} />
      <input className={inputCls()} placeholder="Category (e.g. Transport)" value={category} onChange={(e) => setCategory(e.target.value)} list="expense-cats" />
      <datalist id="expense-cats">
        {existing.map((c) => <option key={c} value={c} />)}
      </datalist>
      <input
        className={inputCls()}
        placeholder="Amount (Ksh.)"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
      />
      <input className={inputCls()} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        disabled={!n || !category}
        onClick={() => onSave({ date, category, amount: n, note })}
        className={`w-full ${accent.bg} disabled:opacity-40 rounded-full py-3 font-semibold`}
      >
        Add spending
      </button>
    </ModalShell>
  );
}

function AddGoalModal({ onClose, onSave, accent }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");

  return (
    <ModalShell title="Add goal" onClose={onClose}>
      <input className={inputCls()} placeholder="Goal name (e.g. New laptop)" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className={inputCls()}
        placeholder="Target amount (Ksh.)"
        inputMode="numeric"
        value={target}
        onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
      />
      <input
        className={inputCls()}
        placeholder="Already saved (optional)"
        inputMode="numeric"
        value={saved}
        onChange={(e) => setSaved(e.target.value.replace(/[^0-9]/g, ""))}
      />
      <button
        disabled={!name || !Number(target)}
        onClick={() => onSave({ name, target: Number(target), saved: Number(saved) || 0 })}
        className={`w-full ${accent.bg} disabled:opacity-40 rounded-full py-3 font-semibold mt-1`}
      >
        Save goal
      </button>
    </ModalShell>
  );
}

function AmountModal({ title, actionLabel, onClose, onSave, accent }) {
  const [amount, setAmount] = useState("");
  const n = Number(amount);
  return (
    <ModalShell title={title} onClose={onClose}>
      <input
        className={inputCls()}
        placeholder="Amount (Ksh.)"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
      />
      <button
        disabled={!n}
        onClick={() => onSave(n)}
        className={`w-full ${accent ? accent.bg : "bg-green-700"} disabled:opacity-40 rounded-full py-3 font-semibold`}
      >
        {actionLabel}
      </button>
    </ModalShell>
  );
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB, generous for a free Supabase Storage tier

function AddResourceModal({ onClose, onSave, accent }) {
  const [category, setCategory] = useState("Courses");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    setError("");
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("That file is over the 20MB limit — try a smaller one.");
      return;
    }
    setFile(f);
  };

  const handleSave = async () => {
    if (!file) return;
    setUploading(true);
    await onSave({ category, file });
    setUploading(false);
  };

  return (
    <ModalShell title="Upload document" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        {RESOURCE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex-1 rounded-full py-2 text-xs font-semibold ${category === c ? accent.bg : "bg-neutral-900 text-neutral-400"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <label className="w-full bg-neutral-900 rounded-xl px-4 py-6 mb-3 flex flex-col items-center justify-center gap-2 cursor-pointer border border-dashed border-neutral-700">
        <Upload size={20} className="text-neutral-400" />
        <span className="text-sm text-neutral-400">{file ? file.name : "Tap to choose a file"}</span>
        <input type="file" className="hidden" onChange={handleFile} />
      </label>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <button
        disabled={!file || uploading}
        onClick={handleSave}
        className={`w-full ${accent.bg} disabled:opacity-40 rounded-full py-3 font-semibold`}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </ModalShell>
  );
}

// ================= HOME =================
