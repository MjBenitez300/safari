// ✅ Ensure user is logged in
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
if (!loggedInUser) {
  alert("Please login first.");
  window.location.href = "index.html";
}

// ✅ Firestore imports
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const recordsTable = document.getElementById("recordsTable");
const viewAllBtn = document.getElementById("viewAllBtn");
const viewGuestBtn = document.getElementById("viewGuestBtn");
const viewEmployeeBtn = document.getElementById("viewEmployeeBtn");
const printBtn = document.getElementById("printBtn");
const exportBtn = document.getElementById("exportBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const backBtn = document.getElementById("backBtn");
const viewHistoryBtn = document.getElementById("viewHistoryBtn");

const historySearchSection = document.getElementById("historySearchSection");
const historySearchInput = document.getElementById("historySearchInput");
const historySearchBtn = document.getElementById("historySearchBtn");
const historyResults = document.getElementById("historyResults");

let currentFilter = null;

// ✅ Helper to render table header
function renderTableHeader() {
  recordsTable.innerHTML = "";
  const header = recordsTable.createTHead().insertRow();
  const headers = [
    "Patient ID", "Name", "Age", "Sex", "Address", "Walk-in Date",
    "Department", "Civil Status", "Chief Complaint", "History", "Medication", "Type", "Actions"
  ];
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    header.appendChild(th);
  });
}

// ✅ Load all records (with filter)
async function loadPatients() {
  renderTableHeader();
  const tbody = recordsTable.createTBody();

  let q = collection(db, "patients");
  if (currentFilter) {
    q = query(q, where("type", "==", currentFilter));
  }

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 12;
    cell.textContent = "No patient records found.";
    cell.style.textAlign = "center";
    return;
  }

  snapshot.forEach((docSnap) => {
    const p = docSnap.data();
    const row = tbody.insertRow();

    const fields = [
      p.patientID || "",
      p.name || p.patientName || "",
      p.age || "",
      p.sex || "",
      p.address || "",
      p.walkInDate || "",
      p.department || "",
      p.civilStatus || "",
      p.chiefComplaint || "",
      p.history || "",
      p.medicationCombined || p.medication || "",
      p.type || ""
    ];

    fields.forEach(val => {
      const cell = row.insertCell();
      cell.textContent = val;
    });

    // Delete button
    const actionCell = row.insertCell();
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      if (confirm("Are you sure you want to delete this record?")) {
        await deleteDoc(doc(db, "patients", docSnap.id));
        alert("Record deleted successfully!");
        loadPatients();
      }
    };
    actionCell.appendChild(delBtn);
  });
}

// ✅ Button filters
viewAllBtn.onclick = () => {
  currentFilter = null;
  loadPatients();
  hideHistorySearch();
};
viewGuestBtn.onclick = () => {
  currentFilter = "guest";
  loadPatients();
  hideHistorySearch();
};
viewEmployeeBtn.onclick = () => {
  currentFilter = "employee";
  loadPatients();
  hideHistorySearch();
};

// ✅ Print table
printBtn.onclick = () => {
  if (recordsTable.rows.length === 0) return alert("No records to print.");
  const newWin = window.open("", "", "width=900,height=600");
  newWin.document.write(`
    <html><head><title>Print</title><style>
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;}
      th{background:#007bff;color:#fff;}
    </style></head><body>
    ${recordsTable.outerHTML}
    </body></html>
  `);
  newWin.document.close();
  newWin.print();
};

// ✅ Export to CSV
exportBtn.onclick = () => {
  if (recordsTable.rows.length === 0) return alert("No records to export.");
  const rows = [...recordsTable.rows].map(r =>
    [...r.cells].map(c => `"${c.textContent}"`).join(",")
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "patient_records.csv";
  a.click();
  URL.revokeObjectURL(url);
};

// ✅ Delete all visible records
deleteAllBtn.onclick = async () => {
  if (!confirm("Delete all displayed records?")) return;
  let q = collection(db, "patients");
  if (currentFilter) {
    q = query(q, where("type", "==", currentFilter));
  }
  const snapshot = await getDocs(q);
  const deletions = snapshot.docs.map(docSnap => deleteDoc(doc(db, "patients", docSnap.id)));
  await Promise.all(deletions);
  alert("All records deleted successfully!");
  loadPatients();
};

// ✅ Navigation
backBtn.onclick = () => window.location.href = "dashboard.html";

// ✅ History search (by name)
viewHistoryBtn.onclick = () => {
  if (historySearchSection.style.display === "none" || historySearchSection.style.display === "") {
    showHistorySearch();
  } else {
    hideHistorySearch();
  }
};

function showHistorySearch() {
  historySearchSection.style.display = "block";
  historySearchInput.focus();
  historyResults.innerHTML = "";
  historySearchInput.value = "";
}

function hideHistorySearch() {
  historySearchSection.style.display = "none";
  historyResults.innerHTML = "";
  historySearchInput.value = "";
}

// ✅ Search patient history by name
historySearchBtn.onclick = async () => {
  const queryName = historySearchInput.value.trim().toLowerCase();
  if (!queryName) {
    alert("Please enter a patient name to search.");
    return;
  }

  const snapshot = await getDocs(collection(db, "patients"));
  const results = snapshot.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .filter(p => (p.name || p.patientName || "").toLowerCase().includes(queryName));

  renderHistoryResults(results);
};

// ✅ Render search results
function renderHistoryResults(results) {
  if (results.length === 0) {
    historyResults.innerHTML = "<p>No records found.</p>";
    return;
  }
  let html = `<table>
    <thead>
      <tr>
        <th>Name</th><th>Walk-in Date</th><th>Medication</th><th>Print</th>
      </tr>
    </thead>
    <tbody>`;
  results.forEach(p => {
    const patientName = p.name || p.patientName || "";
    const medication = p.medication || p.medicationCombined || "";
    html += `<tr>
      <td>${patientName}</td>
      <td>${p.walkInDate || ""}</td>
      <td>${medication}</td>
      <td><button class="printBtn" data-id="${p.id}">Print</button></td>
    </tr>`;
  });
  html += "</tbody></table>";
  historyResults.innerHTML = html;

  document.querySelectorAll(".printBtn").forEach(btn => {
    btn.onclick = () => {
      const patient = results.find(p => p.id === btn.dataset.id);
      printPatientHistory(patient);
    };
  });
}

// ✅ Print single patient
function printPatientHistory(p) {
  const newWin = window.open("", "", "width=900,height=600");
  newWin.document.write(`
    <html><head><title>Patient History</title><style>
      body{font-family:Arial,sans-serif;padding:20px;}
      h2{color:#007bff;}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #ddd;padding:10px;}
      th{background:#007bff;color:white;}
    </style></head><body>
    <h2>${p.name || "Patient"}</h2>
    <table>
      <tr><th>Patient ID</th><td>${p.patientID || ""}</td></tr>
      <tr><th>Name</th><td>${p.name || p.patientName || ""}</td></tr>
      <tr><th>Walk-in Date</th><td>${p.walkInDate || ""}</td></tr>
      <tr><th>Medication</th><td>${p.medication || p.medicationCombined || ""}</td></tr>
      <tr><th>Chief Complaint</th><td>${p.chiefComplaint || ""}</td></tr>
      <tr><th>History</th><td>${p.history || ""}</td></tr>
      <tr><th>Department</th><td>${p.department || ""}</td></tr>
      <tr><th>Civil Status</th><td>${p.civilStatus || ""}</td></tr>
    </table>
    </body></html>
  `);
  newWin.document.close();
  newWin.print();
}

// ✅ Initial load
loadPatients();
