import { auth, db } from "./app.js";
import { initQrScanner } from "./scanner.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
doc,
getDoc,
collection,
setDoc,
updateDoc,
deleteDoc,
onSnapshot,
getDocs,
query,
where,
runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
const adminName = document.getElementById("adminName");

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.replace("index.html");
        return;
    }

    try {

        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (
            !userDoc.exists() ||
            userDoc.data().role !== "admin" ||
            userDoc.data().active !== true
        ) {
            await signOut(auth);
            window.location.replace("index.html");
            return;
        }

        adminName.textContent =
            `Welcome, ${userDoc.data().name}`;
        
// Start live equipment listener
startEquipmentListener();
startPendingStudentsListener();
startActiveBorrowingsListener();
startMaintenanceListener();

initQrScanner(db);
    } catch (error) {

        console.error("Dashboard error:", error);
        adminName.textContent = "Unable to load admin profile.";

    }

});

document.getElementById("logoutBtn").addEventListener("click", async () => {

    await signOut(auth);
    window.location.replace("index.html");

});


// Equipment Modal Functionality

const addEquipmentBtn =
    document.getElementById("addEquipmentBtn");

const equipmentModal =
    document.getElementById("equipmentModal");

const closeModal =
    document.getElementById("closeModal");

// Open modal
if (addEquipmentBtn && equipmentModal) {

    addEquipmentBtn.addEventListener("click", () => {

    editingEquipmentId = null;

    equipmentForm.reset();

    document.getElementById("equipmentId").disabled = false;

    saveEquipmentBtn.textContent = "Save Equipment";

    equipmentMessage.textContent = "";

    equipmentModal.style.display = "flex";

});

}

// Close modal
if (closeModal && equipmentModal) {

    closeModal.addEventListener("click", () => {
        equipmentModal.style.display = "none";
    });

}

// Close modal when clicking outside
if (equipmentModal) {

    equipmentModal.addEventListener("click", (event) => {

        if (event.target === equipmentModal) {
            equipmentModal.style.display = "none";
        }

    });

}


const equipmentForm = document.getElementById("equipmentForm");

const equipmentMessage =
    document.getElementById("equipmentMessage");

const saveEquipmentBtn =
    document.getElementById("saveEquipmentBtn");




if (equipmentForm) {

    equipmentForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const equipmentId =
            document.getElementById("equipmentId").value.trim().toUpperCase();

        const name =
            document.getElementById("equipmentName").value.trim();

        const category =
            document.getElementById("category").value;

        const location =
            document.getElementById("location").value.trim();

        const condition =
            document.getElementById("condition").value;

        saveEquipmentBtn.disabled = true;

        equipmentMessage.textContent = "Saving...";

        try {

            const equipmentRef = doc(db, "equipment", equipmentId);

            if (editingEquipmentId) {

                // UPDATE EXISTING EQUIPMENT

                await updateDoc(equipmentRef, {
                    name,
                    category,
                    location,
                    condition
                });

                equipmentMessage.textContent =
                    "Equipment updated successfully!";

            } else {

                // ADD NEW EQUIPMENT

                const existingEquipment =
                    await getDoc(equipmentRef);

                if (existingEquipment.exists()) {
                    throw new Error("Equipment ID already exists!");
                }

                await setDoc(equipmentRef, {
                    equipmentId,
                    name,
                    category,
                    location,
                    condition,
                    status: "Available",
                    createdAt: new Date()
                });

                equipmentMessage.textContent =
                    "Equipment added successfully!";
            }

            equipmentMessage.style.color = "green";

            equipmentForm.reset();

            editingEquipmentId = null;

            document.getElementById("equipmentId").disabled = false;

            saveEquipmentBtn.textContent = "Save Equipment";

            setTimeout(() => {

                equipmentModal.style.display = "none";
                equipmentMessage.textContent = "";

            }, 1200);

        } catch (error) {

            console.error("Equipment operation error:", error);

            equipmentMessage.textContent = error.message;
            equipmentMessage.style.color = "red";

        } finally {

            saveEquipmentBtn.disabled = false;

        }

    });

}


// ======================================
// LIVE EQUIPMENT INVENTORY
// ======================================

let allEquipment = [];
let editingEquipmentId = null;
const equipmentTable =
    document.getElementById("equipmentTable");

const searchEquipment =
    document.getElementById("searchEquipment");

// Prevent HTML injection in displayed values
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// Render equipment table
function renderEquipmentTable(items) {

    if (!equipmentTable) return;

    if (items.length === 0) {
        equipmentTable.innerHTML = `
            <tr>
                <td colspan="7">No equipment registered yet.</td>
            </tr>
        `;
        return;
    }

    equipmentTable.innerHTML = items.map(item => `

        <tr>
            <td>${escapeHTML(item.equipmentId)}</td>

            <td>${escapeHTML(item.name)}</td>

            <td>${escapeHTML(item.category)}</td>

            <td>${escapeHTML(item.location)}</td>

            <td>${escapeHTML(item.condition)}</td>

            <td>${escapeHTML(item.status)}</td>

            <td>

                <button class="edit-btn"
                    data-id="${escapeHTML(item.documentId)}">
                    Edit
                </button>

                <button class="delete-btn"
                    data-id="${escapeHTML(item.documentId)}">
                    Delete
                </button>

                <button class="qr-btn"
                    data-id="${escapeHTML(item.documentId)}">
                    QR Code
                </button>

                ${
                    item.status === "Available"
                    ? `<button class="issue-btn"
                        data-id="${escapeHTML(item.documentId)}">
                        Issue
                    </button>`
                    : `<span>Not Available</span>`
                }

            </td>
        </tr>

    `).join("");

}

// Issue Equipment Modal Elements

const issueModal = document.getElementById("issueModal");
const closeIssueModal = document.getElementById("closeIssueModal");

const issueForm = document.getElementById("issueForm");
const issueStudent = document.getElementById("issueStudent");

const issueEquipmentDocId =
    document.getElementById("issueEquipmentDocId");

const issueEquipmentId =
    document.getElementById("issueEquipmentId");

const issueEquipmentName =
    document.getElementById("issueEquipmentName");

const issueMessage =
    document.getElementById("issueMessage");

// Load Approved Students from Firestore

async function loadApprovedStudents() {

    issueStudent.innerHTML =
        `<option value="">Loading students...</option>`;

    try {

        const studentsQuery = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("active", "==", true),
            where("status", "==", "approved")
        );

        const snapshot = await getDocs(studentsQuery);

        issueStudent.innerHTML =
            `<option value="">Select a student</option>`;

        if (snapshot.empty) {

            issueStudent.innerHTML =
                `<option value="">No approved students found</option>`;

            return;

        }

        snapshot.forEach(studentDoc => {

            const student = studentDoc.data();

            const option = document.createElement("option");

            option.value = studentDoc.id;

            option.textContent =
                `${student.name || "Student"} (${student.email || ""})`;

            issueStudent.appendChild(option);

        });

    } catch (error) {

        console.error("Student loading error:", error);

        issueStudent.innerHTML =
            `<option value="">Unable to load students</option>`;

    }

}

// Open Issue Modal

equipmentTable.addEventListener("click", async (event) => {

    const issueButton = event.target.closest(".issue-btn");

    if (!issueButton) return;

    const equipmentDocId = issueButton.dataset.id;

    const equipment = allEquipment.find(
        item => item.documentId === equipmentDocId
    );

    if (!equipment) return;

    if (equipment.status !== "Available") {

        alert("This equipment is not available.");

        return;

    }

    issueForm.reset();

    issueEquipmentDocId.value = equipment.documentId;
    issueEquipmentId.value = equipment.equipmentId;
    issueEquipmentName.value = equipment.name;

    issueMessage.textContent = "";

    issueModal.style.display = "flex";

    await loadApprovedStudents();

});

// Close Issue Modal

closeIssueModal.addEventListener("click", () => {

    issueModal.style.display = "none";

});

issueModal.addEventListener("click", (event) => {

    if (event.target === issueModal) {

        issueModal.style.display = "none";

    }

});


// ======================================
// CONFIRM EQUIPMENT ISSUE
// ======================================

const confirmIssueBtn =
    document.getElementById("confirmIssueBtn");

if (issueForm) {

    issueForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const equipmentDocId = issueEquipmentDocId.value;
        const studentUid = issueStudent.value;
        const issueDate = document.getElementById("issueDate").value;
        const dueDate = document.getElementById("dueDate").value;

        // Basic validation
        if (!equipmentDocId || !studentUid || !issueDate || !dueDate) {
            issueMessage.textContent = "Please fill in all fields.";
            issueMessage.style.color = "red";
            return;
        }

        if (dueDate < issueDate) {
            issueMessage.textContent =
                "Due date cannot be earlier than issue date.";
            issueMessage.style.color = "red";
            return;
        }

        confirmIssueBtn.disabled = true;
        issueMessage.textContent = "Processing equipment issue...";
        issueMessage.style.color = "blue";

        try {

            const equipmentRef = doc(db, "equipment", equipmentDocId);
            const studentRef = doc(db, "users", studentUid);

            // Generate a unique borrowing document ID
            const borrowingRef = doc(collection(db, "borrowings"));

            await runTransaction(db, async (transaction) => {

                // Read latest equipment and student records
                const equipmentDoc = await transaction.get(equipmentRef);
                const studentDoc = await transaction.get(studentRef);

                if (!equipmentDoc.exists()) {
                    throw new Error("Equipment does not exist.");
                }

                if (!studentDoc.exists()) {
                    throw new Error("Student account does not exist.");
                }

                const equipment = equipmentDoc.data();
                const student = studentDoc.data();

                // Check equipment availability
                if (equipment.status !== "Available") {
                    throw new Error(
                        "Equipment is not available for issue."
                    );
                }

                // Check student approval
                if (
                    student.role !== "student" ||
                    student.active !== true ||
                    student.status !== "approved"
                ) {
                    throw new Error(
                        "Only approved students can receive equipment."
                    );
                }

                // Create borrowing record
                transaction.set(borrowingRef, {

                    borrowingId: borrowingRef.id,

                    equipmentDocId: equipmentDocId,
                    equipmentId: equipment.equipmentId,
                    equipmentName: equipment.name,

                    studentUid: studentUid,
                    studentName: student.name || "Student",
                    studentEmail: student.email || "",

                    issueDate: issueDate,
                    dueDate: dueDate,

                    status: "Active",

                    issuedByUid: auth.currentUser.uid,
                    createdAt: new Date()

                });

                // Update equipment status
                transaction.update(equipmentRef, {
                    status: "Borrowed",
                    currentBorrowingId: borrowingRef.id
                });

            });

            issueMessage.textContent =
                "Equipment issued successfully!";

            issueMessage.style.color = "green";

            setTimeout(() => {
                issueModal.style.display = "none";
                issueForm.reset();
                issueMessage.textContent = "";
            }, 1200);

        } catch (error) {

            console.error("Equipment issue error:", error);

            issueMessage.textContent = error.message;
            issueMessage.style.color = "red";

        } finally {

            confirmIssueBtn.disabled = false;

        }

    });

}

// Update dashboard statistics
function updateEquipmentStats(items) {

    const total = items.length;

    const available = items.filter(
        item => item.status === "Available"
    ).length;

    const borrowed = items.filter(
        item => item.status === "Borrowed"
    ).length;

    const maintenance = items.filter(
        item.status === "Under Maintenance" ||
item.status === "Maintenance"
    ).length;

    document.getElementById("totalEquipment").textContent = total;

    document.getElementById("availableEquipment").textContent = available;

    document.getElementById("borrowedEquipment").textContent = borrowed;

    document.getElementById("maintenanceEquipment").textContent = maintenance;
}

// Listen for real-time Firestore updates
function startEquipmentListener() {

    const equipmentCollection = collection(db, "equipment");

    onSnapshot(equipmentCollection, (snapshot) => {

        allEquipment = snapshot.docs.map(document => ({
            ...document.data(),
            documentId: document.id
        }));

        renderEquipmentTable(allEquipment);
        updateEquipmentStats(allEquipment);

        console.log("Equipment inventory updated:", allEquipment);

    }, (error) => {

        console.error("Equipment loading error:", error);

        if (equipmentTable) {
            equipmentTable.innerHTML = `
                <tr>
                    <td colspan="7">Unable to load equipment. Check console.</td>
                </tr>
            `;
        }

    });
}

// Search equipment by ID or name
if (searchEquipment) {

    searchEquipment.addEventListener("input", () => {

        const searchValue = searchEquipment.value
            .trim()
            .toLowerCase();

        const filteredEquipment = allEquipment.filter(item =>
            item.equipmentId.toLowerCase().includes(searchValue) ||
            item.name.toLowerCase().includes(searchValue)
        );

        renderEquipmentTable(filteredEquipment);

    });

}


const editModal = document.getElementById("equipmentModal");

equipmentTable.addEventListener("click", (event) => {

    const editButton = event.target.closest(".edit-btn");

    if (!editButton) return;

    const equipment = allEquipment.find(
        item => item.documentId === editButton.dataset.id
    );

    if (!equipment) return;

    editingEquipmentId = equipment.documentId;

    document.getElementById("equipmentId").value =
        equipment.equipmentId;

    document.getElementById("equipmentId").disabled = true;

    document.getElementById("equipmentName").value =
        equipment.name;

    document.getElementById("category").value =
        equipment.category;

    document.getElementById("location").value =
        equipment.location;

    document.getElementById("condition").value =
        equipment.condition;

    document.getElementById("saveEquipmentBtn").textContent =
        "Update Equipment";

    document.getElementById("equipmentMessage").textContent = "";

    editModal.style.display = "flex";

});


// ======================================
// DELETE EQUIPMENT
// ======================================

equipmentTable.addEventListener("click", async (event) => {

    const deleteButton = event.target.closest(".delete-btn");

    if (!deleteButton) return;

    const equipment = allEquipment.find(
        item => item.documentId === deleteButton.dataset.id
    );

    if (!equipment) return;

    // Prevent deleting borrowed equipment
    if (equipment.status === "Borrowed") {
        alert("Borrowed equipment cannot be deleted!");
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to delete ${equipment.name} (${equipment.equipmentId})?`
    );

    if (!confirmed) return;

    try {

        deleteButton.disabled = true;

        await deleteDoc(
            doc(db, "equipment", equipment.documentId)
        );

        alert("Equipment deleted successfully!");

    } catch (error) {

        console.error("Delete error:", error);

        alert("Unable to delete equipment. Please try again.");

        deleteButton.disabled = false;

    }

});


// ======================================
// EQUIPMENT QR CODE GENERATION
// ======================================

const qrModal = document.getElementById("qrModal");

const qrCodeContainer =
    document.getElementById("qrCodeContainer");

const qrEquipmentName =
    document.getElementById("qrEquipmentName");

const qrEquipmentId =
    document.getElementById("qrEquipmentId");

const closeQrModal =
    document.getElementById("closeQrModal");

const downloadQrBtn =
    document.getElementById("downloadQrBtn");

let currentQrEquipmentId = null;

// Generate QR Code
equipmentTable.addEventListener("click", (event) => {

    const qrButton = event.target.closest(".qr-btn");

    if (!qrButton) return;

    const equipment = allEquipment.find(
        item => item.documentId === qrButton.dataset.id
    );

    if (!equipment) return;

    if (!window.QRCode) {
        alert("QR library not loaded. Please refresh the page.");
        return;
    }

    currentQrEquipmentId = equipment.equipmentId;

    qrEquipmentName.textContent = equipment.name;

    qrEquipmentId.textContent =
        "Equipment ID: " + equipment.equipmentId;

    qrCodeContainer.innerHTML = "";

    new window.QRCode(qrCodeContainer, {
        text: equipment.equipmentId,
        width: 220,
        height: 220,
        correctLevel: window.QRCode.CorrectLevel.H
    });

    qrModal.style.display = "flex";

});

// Close QR modal
closeQrModal.addEventListener("click", () => {
    qrModal.style.display = "none";
});

qrModal.addEventListener("click", (event) => {

    if (event.target === qrModal) {
        qrModal.style.display = "none";
    }

});

// Download QR as PNG
downloadQrBtn.addEventListener("click", () => {

    const canvas = qrCodeContainer.querySelector("canvas");
    const image = qrCodeContainer.querySelector("img");

    let imageURL;

    if (canvas) {
        imageURL = canvas.toDataURL("image/png");
    } else if (image && image.src) {
        imageURL = image.src;
    } else {
        alert("QR code is not ready yet.");
        return;
    }

    const link = document.createElement("a");

    link.href = imageURL;
    link.download = `LabTrack-${currentQrEquipmentId}.png`;

    link.click();

});


// =====================================
// STUDENT APPROVAL SYSTEM
// =====================================

function startPendingStudentsListener() {

    const studentsTable = document.getElementById("pendingStudentsTable");
    const pendingCount = document.getElementById("pendingStudentCount");

    if (!studentsTable || !pendingCount) return;

    // Listen to user profiles in Firestore
    const usersCollection = collection(db, "users");

    onSnapshot(usersCollection, (snapshot) => {

        const pendingStudents = snapshot.docs
            .map(document => ({
                uid: document.id,
                ...document.data()
            }))
            .filter(student =>
                student.role === "student" &&
                student.status === "pending"
            );

        pendingCount.textContent =
            `${pendingStudents.length} Pending`;

        studentsTable.replaceChildren();

        if (pendingStudents.length === 0) {

            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.textContent = "No pending student requests.";

            row.appendChild(cell);
            studentsTable.appendChild(row);

            return;
        }

        pendingStudents.forEach(student => {

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = student.name || "N/A";

            const emailCell = document.createElement("td");
            emailCell.textContent = student.email || "N/A";

            const dateCell = document.createElement("td");

            if (student.createdAt?.toDate) {
                dateCell.textContent =
                    student.createdAt.toDate().toLocaleDateString();
            } else {
                dateCell.textContent = "N/A";
            }

            const actionCell = document.createElement("td");

            const approveBtn = document.createElement("button");
            approveBtn.textContent = "Approve";
            approveBtn.className = "approve-student-btn";
            approveBtn.dataset.uid = student.uid;

            const rejectBtn = document.createElement("button");
            rejectBtn.textContent = "Reject";
            rejectBtn.className = "reject-student-btn";
            rejectBtn.dataset.uid = student.uid;

            actionCell.appendChild(approveBtn);
            actionCell.appendChild(rejectBtn);

            row.appendChild(nameCell);
            row.appendChild(emailCell);
            row.appendChild(dateCell);
            row.appendChild(actionCell);

            studentsTable.appendChild(row);

        });

    }, (error) => {

        console.error("Student listener error:", error);

        studentsTable.textContent =
            "Unable to load student requests.";

    });

    // Handle Approve and Reject buttons
    studentsTable.addEventListener("click", async (event) => {

        const button = event.target.closest("button");

        if (!button) return;

        const studentUid = button.dataset.uid;

        if (!studentUid) return;

        const isApprove =
            button.classList.contains("approve-student-btn");

        const isReject =
            button.classList.contains("reject-student-btn");

        if (!isApprove && !isReject) return;

        const action = isApprove ? "approve" : "reject";

        const confirmed = confirm(
            `Are you sure you want to ${action} this student?`
        );

        if (!confirmed) return;

        button.disabled = true;

        try {

            const studentRef = doc(db, "users", studentUid);

            if (isApprove) {

                await updateDoc(studentRef, {
                    active: true,
                    status: "approved"
                });

                alert("Student approved successfully!");

            } else {

                await updateDoc(studentRef, {
                    active: false,
                    status: "rejected"
                });

                alert("Student rejected successfully!");

            }

        } catch (error) {

            console.error("Student approval error:", error);

            alert("Unable to update student status.");

            button.disabled = false;

        }

    });

}
// ======================================
// ACTIVE BORROWINGS & RETURN EQUIPMENT
// ======================================

const activeBorrowingsTable =
    document.getElementById("activeBorrowingsTable");

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Listen for active borrowing records
function startActiveBorrowingsListener() {

    if (!activeBorrowingsTable) return;

    onSnapshot(collection(db, "borrowings"), (snapshot) => {

        const today = getTodayDate();

        const activeBorrowings = snapshot.docs
            .map(document => ({
                ...document.data(),
                documentId: document.id
            }))
            .filter(item => item.status === "Active");

        activeBorrowingsTable.innerHTML = "";

        if (activeBorrowings.length === 0) {

            activeBorrowingsTable.innerHTML = `
                <tr>
                    <td colspan="7">No active borrowings found.</td>
                </tr>
            `;

            return;
        }

        activeBorrowings.forEach(item => {

            const isOverdue = item.dueDate < today;

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(item.equipmentId)}</td>
                <td>${escapeHTML(item.equipmentName)}</td>
                <td>${escapeHTML(item.studentName)}</td>
                <td>${escapeHTML(item.issueDate)}</td>
                <td>${escapeHTML(item.dueDate)}</td>

                <td>
                    <span style="color: ${isOverdue ? "red" : "green"}">
                        ${isOverdue ? "Overdue" : "Active"}
                    </span>
                </td>

                <td>
                    <button
                        class="return-btn"
                        data-id="${escapeHTML(item.documentId)}">
                        Return
                    </button>
                </td>
            `;

            activeBorrowingsTable.appendChild(row);

        });

    }, (error) => {

        console.error("Borrowings listener error:", error);

        activeBorrowingsTable.innerHTML = `
            <tr>
                <td colspan="7">Unable to load active borrowings.</td>
            </tr>
        `;

    });

}

// Handle Return button
if (activeBorrowingsTable) {

    activeBorrowingsTable.addEventListener("click", async (event) => {

        const returnButton = event.target.closest(".return-btn");

        if (!returnButton) return;

        const borrowingId = returnButton.dataset.id;

        const returnCondition = prompt(
            "Enter equipment condition after return:\nGood, Fair, or Damaged"
        );

        if (returnCondition === null) return;

        const condition = returnCondition.trim();

        if (!["Good", "Fair", "Damaged"].includes(condition)) {

            alert("Please enter Good, Fair, or Damaged.");

            return;
        }

        const confirmed = confirm(
            "Are you sure you want to process this return?"
        );

        if (!confirmed) return;

        returnButton.disabled = true;

        try {

            const borrowingRef = doc(db, "borrowings", borrowingId);

            await runTransaction(db, async (transaction) => {

                // Read borrowing record
                const borrowingDoc = await transaction.get(borrowingRef);

                if (!borrowingDoc.exists()) {
                    throw new Error("Borrowing record not found.");
                }

                const borrowing = borrowingDoc.data();

                if (borrowing.status !== "Active") {
                    throw new Error("This equipment has already been returned.");
                }

                // Read equipment record
                const equipmentRef = doc(
                    db,
                    "equipment",
                    borrowing.equipmentDocId
                );

                const equipmentDoc = await transaction.get(equipmentRef);

                if (!equipmentDoc.exists()) {
                    throw new Error("Equipment record not found.");
                }

                // Update borrowing record
                transaction.update(borrowingRef, {
                    status: "Returned",
                    returnDate: getTodayDate(),
                    returnCondition: condition,
                    returnedByUid: auth.currentUser.uid
                });

                // Update equipment availability
                transaction.update(equipmentRef, {
                    status: condition === "Damaged"
                        ? "Under Maintenance"
                        : "Available",

                    condition: condition,
                    currentBorrowingId: null
                });

            });

            alert("Equipment returned successfully!");

        } catch (error) {

            console.error("Return equipment error:", error);

            alert(error.message || "Unable to process equipment return.");

            returnButton.disabled = false;

        }

    });

}
// ======================================
// MAINTENANCE REPORTING SYSTEM
// ======================================

const maintenanceModal = document.getElementById("maintenanceModal");
const reportMaintenanceBtn = document.getElementById("reportMaintenanceBtn");
const closeMaintenanceModal = document.getElementById("closeMaintenanceModal");

const maintenanceForm = document.getElementById("maintenanceForm");
const maintenanceSelect = document.getElementById("maintenanceEquipmentSelect");
const maintenanceDescription = document.getElementById("maintenanceDescription");
const maintenanceDate = document.getElementById("maintenanceDate");
const maintenanceMessage = document.getElementById("maintenanceMessage");
const saveMaintenanceBtn = document.getElementById("saveMaintenanceBtn");

const maintenanceTable = document.getElementById("maintenanceTable");

// Load equipment into dropdown
function loadMaintenanceEquipment() {

    maintenanceSelect.innerHTML =
        `<option value="">Select Equipment</option>`;

    const eligibleEquipment = allEquipment.filter(item =>
        item.status !== "Borrowed"
    );

    eligibleEquipment.forEach(item => {

        const option = document.createElement("option");

        option.value = item.documentId;

        option.textContent =
            `${item.equipmentId} - ${item.name}`;

        maintenanceSelect.appendChild(option);

    });

}

// Open maintenance modal
if (reportMaintenanceBtn) {

    reportMaintenanceBtn.addEventListener("click", () => {

        maintenanceForm.reset();

        maintenanceDate.value = getTodayDate();

        maintenanceMessage.textContent = "";

        loadMaintenanceEquipment();

        maintenanceModal.style.display = "flex";

    });

}

// Close modal
if (closeMaintenanceModal) {

    closeMaintenanceModal.addEventListener("click", () => {
        maintenanceModal.style.display = "none";
    });

}

if (maintenanceModal) {

    maintenanceModal.addEventListener("click", (event) => {

        if (event.target === maintenanceModal) {
            maintenanceModal.style.display = "none";
        }

    });

}

// Submit maintenance report
if (maintenanceForm) {

    maintenanceForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const equipmentDocId = maintenanceSelect.value;
        const description = maintenanceDescription.value.trim();
        const reportDate = maintenanceDate.value;

        if (!equipmentDocId || !description || !reportDate) {
            maintenanceMessage.textContent = "Please fill all fields.";
            return;
        }

        saveMaintenanceBtn.disabled = true;
        maintenanceMessage.textContent = "Submitting report...";

        try {

            const equipmentRef = doc(db, "equipment", equipmentDocId);
            const maintenanceRef = doc(collection(db, "maintenance"));

            await runTransaction(db, async (transaction) => {

                const equipmentDoc = await transaction.get(equipmentRef);

                if (!equipmentDoc.exists()) {
                    throw new Error("Equipment not found.");
                }

                const equipment = equipmentDoc.data();

                if (equipment.status === "Borrowed") {
                    throw new Error("Borrowed equipment cannot be reported for maintenance.");
                }

                transaction.set(maintenanceRef, {

                    equipmentDocId: equipmentDocId,
                    equipmentId: equipment.equipmentId,
                    equipmentName: equipment.name,

                    description: description,
                    reportDate: reportDate,

                    status: "Open",

                    reportedByUid: auth.currentUser.uid,
                    createdAt: new Date()

                });

                transaction.update(equipmentRef, {
                    status: "Under Maintenance"
                });

            });

            maintenanceMessage.textContent = "Maintenance report submitted!";
            maintenanceMessage.style.color = "green";

            setTimeout(() => {
                maintenanceModal.style.display = "none";
                maintenanceForm.reset();
            }, 1000);

        } catch (error) {

            console.error("Maintenance report error:", error);

            maintenanceMessage.textContent =
                error.message || "Unable to submit report.";

            maintenanceMessage.style.color = "red";

        } finally {

            saveMaintenanceBtn.disabled = false;

        }

    });

}

// Live maintenance records
function startMaintenanceListener() {

    if (!maintenanceTable) return;

    onSnapshot(collection(db, "maintenance"), (snapshot) => {

        maintenanceTable.innerHTML = "";

        if (snapshot.empty) {

            maintenanceTable.innerHTML = `
                <tr>
                    <td colspan="6">No maintenance records found.</td>
                </tr>
            `;

            return;
        }

        snapshot.forEach(maintenanceDoc => {

            const item = maintenanceDoc.data();
            const row = document.createElement("tr");

            const actionButton = item.status !== "Resolved"
                ? `<button class="resolve-maintenance-btn"
                    data-id="${escapeHTML(maintenanceDoc.id)}">
                    Resolve
                   </button>`
                : "Completed";

            row.innerHTML = `
                <td>${escapeHTML(item.equipmentId)}</td>
                <td>${escapeHTML(item.equipmentName)}</td>
                <td>${escapeHTML(item.description)}</td>
                <td>${escapeHTML(item.reportDate)}</td>
                <td>${escapeHTML(item.status)}</td>
                <td>${actionButton}</td>
            `;

            maintenanceTable.appendChild(row);

        });

    }, (error) => {

        console.error("Maintenance listener error:", error);

        maintenanceTable.innerHTML = `
            <tr>
                <td colspan="6">Unable to load maintenance records.</td>
            </tr>
        `;

    });

}

// Resolve maintenance issue
if (maintenanceTable) {

    maintenanceTable.addEventListener("click", async (event) => {

        const resolveButton =
            event.target.closest(".resolve-maintenance-btn");

        if (!resolveButton) return;

        const maintenanceId = resolveButton.dataset.id;

        const confirmed = confirm(
            "Has the maintenance work been completed?"
        );

        if (!confirmed) return;

        resolveButton.disabled = true;

        try {

            const maintenanceRef = doc(db, "maintenance", maintenanceId);

            await runTransaction(db, async (transaction) => {

                const maintenanceDoc =
                    await transaction.get(maintenanceRef);

                if (!maintenanceDoc.exists()) {
                    throw new Error("Maintenance record not found.");
                }

                const maintenance = maintenanceDoc.data();

                if (maintenance.status === "Resolved") {
                    throw new Error("This issue is already resolved.");
                }

                const equipmentRef = doc(
                    db,
                    "equipment",
                    maintenance.equipmentDocId
                );

                const equipmentDoc =
                    await transaction.get(equipmentRef);

                if (!equipmentDoc.exists()) {
                    throw new Error("Equipment record not found.");
                }

                transaction.update(maintenanceRef, {
                    status: "Resolved",
                    resolvedAt: new Date(),
                    resolvedByUid: auth.currentUser.uid
                });

                transaction.update(equipmentRef, {
                    status: "Available",
                    condition: "Good",
                    currentBorrowingId: null
                });

            });

            alert("Maintenance resolved successfully!");

        } catch (error) {

            console.error("Maintenance resolution error:", error);

            alert(error.message || "Unable to resolve maintenance.");

            resolveButton.disabled = false;

        }

    });

}