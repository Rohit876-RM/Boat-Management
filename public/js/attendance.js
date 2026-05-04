// ── Attendance Module ────────────────────────────────────────────
const Attendance = (() => {
  let workersList = [];
  let attendanceData = [];
  let currentDate = new Date().toISOString().split('T')[0];

  const load = async () => {
    const el = document.getElementById('attendance-list');
    if (!el) return;
    el.innerHTML = `<div class="loader"><i class="fa-solid fa-spinner"></i></div>`;
    
    const user = App.getUser();
    if (user?.role !== 'owner' && !user?.canMarkAttendance) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-lock"></i><p>Access denied. You do not have permission to mark attendance.</p></div>`;
      return;
    }

    // Load active workers
    const wData = await API.get('/users?role=worker&isActive=true');
    if (wData.success) workersList = wData.data;

    // Load attendance for the selected date
    const dateInput = document.getElementById('attendance-date');
    if (dateInput) {
      if (!dateInput.value) dateInput.value = currentDate;
      currentDate = dateInput.value;
    }

    const aData = await API.get(`/attendance?date=${currentDate}`);
    if (aData.success) attendanceData = aData.data;

    render();
  };

  const render = () => {
    const el = document.getElementById('attendance-list');
    if (!workersList.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><p>No active workers found.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${I18n.t('worker_name') || 'Worker'}</th>
              <th>Status</th>
              <th>${I18n.t('daily_wage') || 'Wage (₹)'}</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${workersList.map(w => {
              const record = attendanceData.find(a => a.worker._id === w._id || a.worker === w._id);
              const status = record ? record.status : 'unmarked';
              
              let statusHtml = '';
              if (status === 'present') statusHtml = '<span class="badge badge-success">Present</span>';
              else if (status === 'absent') statusHtml = '<span class="badge badge-danger">Absent</span>';
              else if (status === 'half-day') statusHtml = '<span class="badge badge-warning">Half-Day</span>';
              else statusHtml = '<span class="badge badge-planned" style="background:#4b5563;color:#fff">Unmarked</span>';

              return `
                <tr>
                  <td>
                    <div style="font-weight:600">${w.name}</div>
                    <div style="font-size:0.75rem;color:var(--text2)">@${w.username}</div>
                  </td>
                  <td id="status-${w._id}">${statusHtml}</td>
                  <td>${Utils.fmt(w.dailyWage || 0)}/day</td>
                  <td>
                    <div class="btn-group" style="display:flex;gap:4px">
                      <button class="btn btn-sm ${status === 'present' ? 'btn-success' : 'btn-ghost'}" onclick="Attendance.mark('${w._id}', 'present')">
                        <i class="fa-solid fa-check"></i> Present
                      </button>
                      <button class="btn btn-sm ${status === 'half-day' ? 'btn-warning' : 'btn-ghost'}" onclick="Attendance.mark('${w._id}', 'half-day')">
                        <i class="fa-solid fa-star-half-stroke"></i> Half
                      </button>
                      <button class="btn btn-sm ${status === 'absent' ? 'btn-danger' : 'btn-ghost'}" onclick="Attendance.mark('${w._id}', 'absent')">
                        <i class="fa-solid fa-xmark"></i> Absent
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
        <button class="btn btn-primary btn-large" onclick="Attendance.saveAll()">
          <i class="fa-solid fa-save"></i> Save Attendance
        </button>
      </div>
    `;
  };

  const pendingMarks = {};

  const mark = (workerId, status) => {
    pendingMarks[workerId] = status;
    
    // Optimistic UI update
    let statusHtml = '';
    if (status === 'present') statusHtml = '<span class="badge badge-success">Present</span>';
    else if (status === 'absent') statusHtml = '<span class="badge badge-danger">Absent</span>';
    else if (status === 'half-day') statusHtml = '<span class="badge badge-warning">Half-Day</span>';
    
    document.getElementById(`status-${workerId}`).innerHTML = statusHtml;

    // Update button states
    const row = document.getElementById(`status-${workerId}`).closest('tr');
    const btns = row.querySelectorAll('.btn-sm');
    btns[0].className = `btn btn-sm ${status === 'present' ? 'btn-success' : 'btn-ghost'}`;
    btns[1].className = `btn btn-sm ${status === 'half-day' ? 'btn-warning' : 'btn-ghost'}`;
    btns[2].className = `btn btn-sm ${status === 'absent' ? 'btn-danger' : 'btn-ghost'}`;
  };

  const saveAll = async () => {
    const records = [];
    
    // Combine existing records with pending marks
    workersList.forEach(w => {
      const existing = attendanceData.find(a => a.worker._id === w._id || a.worker === w._id);
      const newStatus = pendingMarks[w._id];
      
      if (newStatus) {
        records.push({ worker: w._id, status: newStatus });
      } else if (existing) {
        records.push({ worker: w._id, status: existing.status });
      } else {
        // Default unmarked to absent or skip? Let's skip unmarked so they can be filled later.
      }
    });

    if (records.length === 0) {
      Toast.info('No attendance changes to save.');
      return;
    }

    const data = await API.post('/attendance', { date: currentDate, records });
    if (data.success) {
      Toast.success('Attendance saved! Wages generated in Payments.');
      // Clear pending and reload
      Object.keys(pendingMarks).forEach(k => delete pendingMarks[k]);
      load();
    } else {
      Toast.error(data.message);
    }
  };

  return { load, mark, saveAll };
})();
