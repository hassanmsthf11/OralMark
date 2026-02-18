// --- State Management ---
const DEFAULT_SECTIONS = [
    { id: 1, name: "Reading", max: 20 },
    { id: 2, name: "Listening", max: 20 },
    { id: 3, name: "Speaking", max: 60 }
];

const DEFAULT_HOTKEYS = [
    { key: "q", value: 2, label: "Minor Error" },
    { key: "w", value: 5, label: "Major Error" }
];

let config = {
    sections: [],
    hotkeys: []
};

let students = []; // [{ id, name, marks: { sectionId: value }, total: 0 }]

// --- DOM Elements ---
const app = document.getElementById('app');
const setupPanel = document.getElementById('setup-panel');
const markingPanel = document.getElementById('marking-panel');
const sectionsList = document.getElementById('sections-list');
const hotkeysList = document.getElementById('hotkeys-list');
const marksTableHead = document.getElementById('table-header');
const marksTableBody = document.getElementById('table-body');
const hotkeyLegend = document.getElementById('hotkey-legend');

// --- Initialization ---
function init() {
    loadData();
    if (config.sections.length === 0) {
        config.sections = [...DEFAULT_SECTIONS];
        config.hotkeys = [...DEFAULT_HOTKEYS];
    }
    document.getElementById('exam-title-input').value = config.examTitle || ''; // Set title input
    renderSetup();

    // Check if we should be in marking mode (if students exist or config saved)
    if (localStorage.getItem('oralTest_mode') === 'marking') {
        startMarking();
    }
}

document.getElementById('exam-title-input').onchange = (e) => {
    config.examTitle = e.target.value;
    saveData();
};

// --- Persistence ---
function saveData() {
    localStorage.setItem('oralTest_config', JSON.stringify(config));
    localStorage.setItem('oralTest_students', JSON.stringify(students));
}

function loadData() {
    const savedConfig = localStorage.getItem('oralTest_config');
    const savedStudents = localStorage.getItem('oralTest_students');
    if (savedConfig) config = JSON.parse(savedConfig);
    if (savedStudents) students = JSON.parse(savedStudents);
}

// --- Setup View Logic ---
function renderSetup() {
    // Render Sections
    sectionsList.innerHTML = '';
    config.sections.forEach((sec, index) => {
        const row = document.createElement('div');
        row.className = 'config-row';
        row.innerHTML = `
            <input type="text" value="${sec.name}" placeholder="Section Name" onchange="updateSection(${index}, 'name', this.value)">
            <input type="number" value="${sec.max}" placeholder="Max Marks" style="width: 80px" onchange="updateSection(${index}, 'max', this.value)">
            <button class="btn-remove" onclick="removeSection(${index})">&times;</button>
        `;
        sectionsList.appendChild(row);
    });

    // Render Hotkeys
    hotkeysList.innerHTML = '';
    config.hotkeys.forEach((hk, index) => {
        const row = document.createElement('div');
        row.className = 'config-row';
        row.innerHTML = `
            <input type="text" value="${hk.key}" placeholder="Key" style="width: 50px; text-align: center;" maxlength="1" onchange="updateHotkey(${index}, 'key', this.value)">
            <input type="number" value="${hk.value}" placeholder="Deduction" style="width: 80px" onchange="updateHotkey(${index}, 'value', this.value)">
            <input type="text" value="${hk.label}" placeholder="Label" onchange="updateHotkey(${index}, 'label', this.value)">
            <button class="btn-remove" onclick="removeHotkey(${index})">&times;</button>
        `;
        hotkeysList.appendChild(row);
    });
}

window.updateSection = (index, field, value) => {
    if (field === 'max') value = parseInt(value) || 0;
    config.sections[index][field] = value;
    saveData();
};

window.removeSection = (index) => {
    config.sections.splice(index, 1);
    renderSetup();
    saveData();
};

document.getElementById('add-section-btn').onclick = () => {
    config.sections.push({ id: Date.now(), name: '', max: 10 });
    renderSetup();
    saveData();
};

window.updateHotkey = (index, field, value) => {
    if (field === 'value') value = parseInt(value) || 0;
    if (field === 'key') value = value.toLowerCase();
    config.hotkeys[index][field] = value;
    saveData();
};

window.removeHotkey = (index) => {
    config.hotkeys.splice(index, 1);
    renderSetup();
    saveData();
};

document.getElementById('add-hotkey-btn').onclick = () => {
    config.hotkeys.push({ key: '', value: 1, label: '' });
    renderSetup();
    saveData();
};

document.getElementById('start-btn').onclick = () => {
    if (config.sections.length === 0) {
        alert("Please add at least one section.");
        return;
    }
    localStorage.setItem('oralTest_mode', 'marking');
    startMarking();
};

// --- Marking View Logic ---
function updateStats() {
    const countEl = document.getElementById('stat-count');
    const avgEl = document.getElementById('stat-avg');
    const highEl = document.getElementById('stat-high');
    const lowEl = document.getElementById('stat-low');
    const maxEl = document.getElementById('stat-max');
    if (!countEl) return;

    const maxPossible = config.sections.reduce((sum, s) => sum + (parseInt(s.max) || 0), 0);
    maxEl.textContent = maxPossible;

    const named = students.filter(s => s.name.trim() !== '');
    countEl.textContent = named.length;

    if (named.length === 0) {
        avgEl.textContent = highEl.textContent = lowEl.textContent = '—';
        return;
    }

    const totals = named.map(s => calculateTotal(s));
    const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1);
    avgEl.textContent = avg;
    highEl.textContent = Math.max(...totals);
    lowEl.textContent = Math.min(...totals);
}

function startMarking() {
    setupPanel.classList.add('hidden');
    markingPanel.classList.remove('hidden');

    // Update session title in header
    const titleDisplay = document.getElementById('session-title-display');
    if (titleDisplay) titleDisplay.textContent = config.examTitle || 'Marking Session';

    const sessionInfo = document.getElementById('session-info');
    if (sessionInfo) {
        const totalMax = config.sections.reduce((sum, s) => sum + (parseInt(s.max) || 0), 0);
        sessionInfo.textContent = `${config.sections.length} section${config.sections.length !== 1 ? 's' : ''} · ${totalMax} marks total`;
    }

    renderTableStructure();
    renderRows();
    renderLegend();

    // If no students, add an initial empty row
    if (students.length === 0) {
        addNewRow();
    }
}

function renderTableStructure() {
    marksTableHead.innerHTML = `<th>Name</th>`;
    config.sections.forEach(sec => {
        marksTableHead.innerHTML += `<th>${sec.name} (${sec.max})</th>`;
    });
    marksTableHead.innerHTML += `<th>Total</th><th>Actions</th>`;
}

function renderRows() {
    updateStats();
    marksTableBody.innerHTML = '';
    students.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.dataset.index = index;

        // Name Cell - Added onkeydown to handle Enter navigation
        let html = `<td><input type="text" class="student-name" value="${student.name}" onchange="updateStudentName(${index}, this.value)" onkeydown="handleNameKeydown(event, ${index})"></td>`;

        // Section Cells
        config.sections.forEach((sec, secIndex) => {
            const marks = student.marks[sec.id] !== undefined ? student.marks[sec.id] : sec.max;
            html += `<td>
                <input type="number" 
                       class="mark-input" 
                       data-section="${sec.id}" 
                       data-max="${sec.max}"
                       value="${marks}"
                       oninput="handleMarkInput(this, ${index}, ${sec.id}, ${sec.max})"
                       onkeydown="handleMarkKeydown(event, ${index}, ${secIndex})"
                       onfocus="this.select()">
            </td>`;
        });

        // Total & Actions
        html += `<td class="total-cell" id="total-${index}">${calculateTotal(student)}</td>`;
        html += `<td><button class="btn-remove" onclick="deleteRow(${index})">&times;</button></td>`;

        tr.innerHTML = html;
        marksTableBody.appendChild(tr);
    });
}

function renderLegend() {
    hotkeyLegend.innerHTML = '';
    config.hotkeys.forEach(hk => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="kbd">${hk.key.toUpperCase()}</span> -${hk.value} (${hk.label})`;
        hotkeyLegend.appendChild(item);
    });
}

function calculateTotal(student) {
    let total = 0;
    config.sections.forEach(sec => {
        const val = student.marks[sec.id];
        total += (val !== undefined) ? parseInt(val) : sec.max;
    });
    return total;
}

window.addNewRow = () => {
    const newStudent = {
        id: Date.now(),
        name: '',
        marks: {}, // Initialize empty, will default to max in UI
        total: 0
    };
    // Pre-fill marks with max
    config.sections.forEach(sec => newStudent.marks[sec.id] = sec.max);

    students.push(newStudent);
    saveData();
    renderRows();

    // Focus the name of the new row
    setTimeout(() => {
        const rows = marksTableBody.querySelectorAll('tr');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
            const nameInput = lastRow.querySelector('.student-name');
            if (nameInput) nameInput.focus();
        }
    }, 0);
};

window.updateStudentName = (index, value) => {
    students[index].name = value;
    saveData();
};

window.handleNameKeydown = (e, index) => {
    // Navigation (Arrows)
    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
        handleNavigation(e, index, -1);
        return;
    }
    // Enter or Right Arrow acts as "Next Column" from Name -> First Section
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        const row = marksTableBody.children[index];
        const firstInput = row.querySelectorAll('.mark-input')[0];
        if (firstInput) firstInput.focus();
    }
};

window.handleMarkInput = (input, studentIndex, sectionId, max) => {
    let value = input.value;

    // REMOVED: Auto-jump logic (2 digits)

    // Basic validation
    let numVal = parseInt(value);
    if (isNaN(numVal)) numVal = 0;
    if (numVal > max) numVal = max; // Cap at max
    if (numVal < 0) numVal = 0;

    students[studentIndex].marks[sectionId] = numVal;

    // Update Total UI immediatley
    document.getElementById(`total-${studentIndex}`).innerText = calculateTotal(students[studentIndex]);
    updateStats();
    saveData();
};

window.handleMarkKeydown = (e, studentIndex, sectionIndex) => {
    const key = e.key.toLowerCase();
    const input = e.target;

    // Navigation (Arrows)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        handleNavigation(e, studentIndex, sectionIndex);
        return;
    }

    // Hotkeys for Deduction
    const hotkey = config.hotkeys.find(hk => hk.key === key);
    if (hotkey) {
        e.preventDefault();
        let currentVal = parseInt(input.value) || 0;
        let newVal = currentVal - hotkey.value;
        if (newVal < 0) newVal = 0;
        input.value = newVal;
        // Trigger input event manually to update state
        input.dispatchEvent(new Event('input'));

        // IMPORTANT context: User asked for "updates happen in that column until Enter is clicked".
        // So we do NOT move focus here.
        return;
    }

    // Enter Key -> Move to Next Column (or New Row if at end)
    if (e.key === 'Enter' || e.key === 'Tab') { // Tab handling is default, but explicit Enter handling is needed
        e.preventDefault();

        const row = marksTableBody.children[studentIndex];
        const inputs = Array.from(row.querySelectorAll('.mark-input'));

        // If there is a next input in this row, focus it
        if (sectionIndex < inputs.length - 1) {
            inputs[sectionIndex + 1].focus();
        } else {
            // We are at the last column. 
            // If this is the last row, creating new row.
            // If not, move to next row name? Or same logic as default?
            // "Enter creates new row" typical logic:

            if (studentIndex === students.length - 1) {
                addNewRow(); // This creates and focuses next row's name
            } else {
                // Focus next row's name
                const nextRow = marksTableBody.children[studentIndex + 1];
                const nextName = nextRow.querySelector('.student-name');
                if (nextName) nextName.focus();
            }
        }
    }
};

window.handleNavigation = (e, rowIndex, colIndex) => {
    const rows = Array.from(marksTableBody.querySelectorAll('tr'));
    const inputs = Array.from(rows[rowIndex].querySelectorAll('input')); // Name + Sections

    // colIndex: -1 is Name, 0+ are sections
    // input index in row: 0 is Name, 1+ are sections
    const currentInputIdx = colIndex + 1;

    if (e.key === 'ArrowRight') {
        if (currentInputIdx < inputs.length - 1) inputs[currentInputIdx + 1].focus();
    } else if (e.key === 'ArrowLeft') {
        if (currentInputIdx > 0) inputs[currentInputIdx - 1].focus();
    } else if (e.key === 'ArrowDown') {
        if (rowIndex < rows.length - 1) {
            // Find inputs of next row
            const nextRowInputs = rows[rowIndex + 1].querySelectorAll('input');
            if (nextRowInputs[currentInputIdx]) nextRowInputs[currentInputIdx].focus();
        }
    } else if (e.key === 'ArrowUp') {
        if (rowIndex > 0) {
            // Find inputs of prev row
            const prevRowInputs = rows[rowIndex - 1].querySelectorAll('input');
            if (prevRowInputs[currentInputIdx]) prevRowInputs[currentInputIdx].focus();
        }
    }
};

window.deleteRow = (index) => {
    if (confirm("Delete this student?")) {
        students.splice(index, 1);
        saveData();
        renderRows();
    }
};

// --- Global Actions ---
document.getElementById('reset-btn').onclick = () => {
    // Custom Modal or simple confirm
    if (confirm("End this session and return to configuration? Student data will be cleared.")) {
        students = [];
        localStorage.removeItem('oralTest_mode'); // Clear marking mode
        localStorage.removeItem('oralTest_students'); // Clear data

        // Don't clear config (sections/hotkeys) so user can reuse or modify them

        // UI Switch
        markingPanel.classList.add('hidden');
        setupPanel.classList.remove('hidden');
        renderSetup();
    }
};

document.getElementById('export-btn').onclick = () => {
    let csv = "Name,";
    config.sections.forEach(s => csv += `${s.name},`);
    csv += "Total\n";

    students.forEach(s => {
        csv += `"${s.name}",`;
        config.sections.forEach(sec => {
            csv += `${s.marks[sec.id] || 0},`;
        });
        csv += `${calculateTotal(s)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oral_test_marks_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
};

document.getElementById('export-pdf-btn').onclick = () => {
    const element = document.getElementById('marks-table');
    const title = config.examTitle || "Oral Test Results";
    const date = new Date().toLocaleDateString();

    // Calculate Summary Stats
    const totalMarksValues = students.map(s => calculateTotal(s));
    const avgScore = totalMarksValues.length ? (totalMarksValues.reduce((a, b) => a + b, 0) / totalMarksValues.length).toFixed(1) : 0;
    const maxScore = totalMarksValues.length ? Math.max(...totalMarksValues) : 0;

    const opt = {
        margin: 0.4,
        filename: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Create a container for the PDF content
    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    container.style.color = '#333';
    container.style.backgroundColor = '#fff';

    // 1. Decorative Header
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
            <div>
                <h1 style="margin: 0; font-size: 26px; color: #1e3a8a; font-weight: 700;">${title}</h1>
                <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Date: <strong>${date}</strong></p>
            </div>
            <div style="text-align: right;">
                <div style="background: #eff6ff; padding: 10px 20px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #3b82f6; font-weight: 600; text-transform: uppercase;">Average Score</p>
                    <p style="margin: 0; font-size: 24px; color: #1e40af; font-weight: 800;">${avgScore}</p>
                </div>
            </div>
        </div>
    `;

    // 2. Clone table and style for PDF
    const cloneTable = element.cloneNode(true);
    cloneTable.style.width = '100%';
    cloneTable.style.borderCollapse = 'collapse';
    cloneTable.style.marginBottom = '20px';
    cloneTable.style.fontSize = '12px';

    // Style Headers
    const headers = cloneTable.querySelectorAll('th');
    headers.forEach((th, index) => {
        th.style.backgroundColor = '#1e293b'; // Dark header
        th.style.color = '#ffffff';
        th.style.padding = '10px 12px';
        th.style.border = '1px solid #1e293b';
        th.style.textAlign = 'left';
        th.style.fontWeight = '600';
        th.style.textTransform = 'uppercase';
        th.style.fontSize = '11px';

        // Remove 'Actions' header (last one)
        if (index === headers.length - 1) {
            th.style.display = 'none';
        }
    });

    // Style Rows & Cells
    const rows = cloneTable.querySelectorAll('tr');
    rows.forEach((row, rowIndex) => {
        // Skip header row in body processing logic if any (usually th are in thead)
        if (row.parentNode.tagName === 'THEAD') return;

        // Removing Actions Cell (last cell)
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length > 0) {
            cells[cells.length - 1].style.display = 'none'; // Hide delete button column
        }

        cells.forEach((td, cellIndex) => {
            if (cellIndex === cells.length - 1) return; // Skip the hidden actions cell

            td.style.padding = '10px 12px';
            td.style.borderBottom = '1px solid #e2e8f0';
            td.style.borderRight = '1px solid #e2e8f0';
            td.style.borderLeft = '1px solid #e2e8f0';
            td.style.color = '#334155';

            // Handle Inputs: Replace with text
            const input = td.querySelector('input');
            if (input) {
                td.innerHTML = `<span style="font-weight: 500;">${input.value}</span>`;
            }

            // Highlight Total Column (Second to last visual column)
            // Name | S1 | S2 | Total | Actions(hidden)
            // If we have N sections, Total is at index N+1 (0-based)
            if (td.classList.contains('total-cell')) {
                td.style.fontWeight = '800';
                td.style.color = '#1e40af';
                td.style.backgroundColor = '#f0f9ff';
                td.style.fontSize = '14px';
                // Explicitly copy text content again just in case
                // td.innerText is already set, but ensuring style visibility
            }
        });

        // Zebra Striping
        if (rowIndex % 2 === 0) {
            row.style.backgroundColor = '#f8fafc';
        } else {
            row.style.backgroundColor = '#ffffff';
        }
    });

    container.appendChild(cloneTable);

    // 3. Footer
    const footer = document.createElement('div');
    footer.innerHTML = `
        <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Generated by Oral Test Marking System • ${date}
        </div>
    `;
    container.appendChild(footer);

    html2pdf().set(opt).from(container).save();
};

init();