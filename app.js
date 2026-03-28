import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const loginForm = document.getElementById("loginForm");
const authMessage = document.getElementById("authMessage");
const roleSelect = document.getElementById("role");
const welcomeTitle = document.getElementById("welcomeTitle");
const welcomeMeta = document.getElementById("welcomeMeta");

const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

const announcementList = document.getElementById("announcementList");
const assignmentList = document.getElementById("assignmentList");
const attendanceList = document.getElementById("attendanceList");
const gradeList = document.getElementById("gradeList");

const adminNoticeCard = document.getElementById("adminNoticeCard");
const teacherAssignmentCard = document.getElementById("teacherAssignmentCard");
const teacherAttendanceCard = document.getElementById("teacherAttendanceCard");
const teacherGradeCard = document.getElementById("teacherGradeCard");

const announcementForm = document.getElementById("announcementForm");
const assignmentForm = document.getElementById("assignmentForm");
const attendanceForm = document.getElementById("attendanceForm");
const gradeForm = document.getElementById("gradeForm");

let state = {
  user: null,
  profile: null,
};

const roleCanManageAcademic = (role) => role === "teacher" || role === "admin";

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#d73a49" : "#146c2e";
}

function toggleRoleCards(role) {
  adminNoticeCard.classList.toggle("hidden", role !== "admin");
  const hideAcademicCards = !roleCanManageAcademic(role);
  teacherAssignmentCard.classList.toggle("hidden", hideAcademicCards);
  teacherAttendanceCard.classList.toggle("hidden", hideAcademicCards);
  teacherGradeCard.classList.toggle("hidden", hideAcademicCards);
}

function renderList(listNode, rows, formatter) {
  listNode.innerHTML = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.textContent = "No records found.";
    listNode.appendChild(li);
    return;
  }

  rows.forEach((row) => {
    const li = document.createElement("li");
    li.innerHTML = formatter(row);
    listNode.appendChild(li);
  });
}

async function loadDashboardData() {
  const role = state.profile?.role;
  const profileId = state.profile?.id;

  const [{ data: announcements }, { data: assignments }] = await Promise.all([
    supabase.from("announcements").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("assignments").select("id,title,class_name,due_date,created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  renderList(
    announcementList,
    announcements || [],
    (row) => `<strong>${row.title}</strong><br/><small>${row.body}</small>`
  );

  renderList(
    assignmentList,
    assignments || [],
    (row) => `<strong>${row.title}</strong> (${row.class_name})<br/><small>Due: ${row.due_date}</small>`
  );

  let attendanceQuery = supabase
    .from("attendance")
    .select("id,status,attendance_date,student_id")
    .order("attendance_date", { ascending: false })
    .limit(20);

  let gradesQuery = supabase
    .from("grades")
    .select("id,subject,score,created_at,student_id")
    .order("created_at", { ascending: false })
    .limit(20);

  if (role === "student") {
    attendanceQuery = attendanceQuery.eq("student_id", profileId);
    gradesQuery = gradesQuery.eq("student_id", profileId);
  }

  const [{ data: attendance }, { data: grades }] = await Promise.all([attendanceQuery, gradesQuery]);

  renderList(
    attendanceList,
    attendance || [],
    (row) => `<strong>${row.status}</strong> <small>on ${row.attendance_date}</small><br/><small>Student ID: ${row.student_id}</small>`
  );

  renderList(
    gradeList,
    grades || [],
    (row) => `<strong>${row.subject}</strong>: ${row.score}/100<br/><small>Student ID: ${row.student_id}</small>`
  );
}

async function loadUserProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,class_name")
    .eq("id", userId)
    .single();

  if (error) throw error;

  state.profile = data;
  welcomeTitle.textContent = `Welcome, ${data.full_name}`;
  welcomeMeta.textContent = `${data.role.toUpperCase()}${data.class_name ? ` • ${data.class_name}` : ""}`;

  toggleRoleCards(data.role);
}

async function startAppForSession(session) {
  state.user = session.user;
  await loadUserProfile(session.user.id);
  await loadDashboardData();

  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
}

async function boot() {
  if (SUPABASE_URL.includes("YOUR-PROJECT") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
    showAuthMessage("Update SUPABASE_URL and SUPABASE_ANON_KEY in app.js before using.", true);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    try {
      await startAppForSession(session);
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const selectedRole = roleSelect.value;

  try {
    showAuthMessage("Signing in...");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError) throw profileError;

    if (profile.role !== selectedRole) {
      await supabase.auth.signOut();
      throw new Error(`Role mismatch. This account is registered as '${profile.role}'.`);
    }

    await startAppForSession(data.session);
    showAuthMessage("Login successful");
  } catch (error) {
    showAuthMessage(error.message, true);
  }
});

refreshBtn.addEventListener("click", async () => {
  await loadDashboardData();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  state = { user: null, profile: null };
  appSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  showAuthMessage("Logged out");
});

announcementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.profile?.role !== "admin") return;

  const title = document.getElementById("announcementTitle").value.trim();
  const body = document.getElementById("announcementBody").value.trim();

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    posted_by: state.profile.id,
  });

  if (error) {
    alert(error.message);
    return;
  }

  announcementForm.reset();
  await loadDashboardData();
});

assignmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!roleCanManageAcademic(state.profile?.role)) return;

  const payload = {
    title: document.getElementById("assignmentTitle").value.trim(),
    class_name: document.getElementById("assignmentClass").value.trim(),
    due_date: document.getElementById("assignmentDueDate").value,
    created_by: state.profile.id,
  };

  const { error } = await supabase.from("assignments").insert(payload);
  if (error) return alert(error.message);

  assignmentForm.reset();
  await loadDashboardData();
});

attendanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!roleCanManageAcademic(state.profile?.role)) return;

  const payload = {
    student_id: document.getElementById("attendanceStudentId").value.trim(),
    attendance_date: document.getElementById("attendanceDate").value,
    status: document.getElementById("attendanceStatus").value,
    marked_by: state.profile.id,
  };

  const { error } = await supabase.from("attendance").insert(payload);
  if (error) return alert(error.message);

  attendanceForm.reset();
  await loadDashboardData();
});

gradeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!roleCanManageAcademic(state.profile?.role)) return;

  const payload = {
    student_id: document.getElementById("gradeStudentId").value.trim(),
    subject: document.getElementById("gradeSubject").value.trim(),
    score: Number(document.getElementById("gradeScore").value),
    graded_by: state.profile.id,
  };

  const { error } = await supabase.from("grades").insert(payload);
  if (error) return alert(error.message);

  gradeForm.reset();
  await loadDashboardData();
});

boot();
