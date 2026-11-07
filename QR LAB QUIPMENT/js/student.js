
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
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// HTML Elements
const studentName = document.getElementById("studentName");

const totalEquipment =
    document.getElementById("totalEquipment");

const availableEquipment =
    document.getElementById("availableEquipment");

const borrowedEquipment =
    document.getElementById("borrowedEquipment");

const equipmentTable =
    document.getElementById("equipmentTable");

const searchEquipment =
    document.getElementById("searchEquipment");

let allEquipment = [];

// Escape HTML to safely display database values
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);

}

// Render Equipment Table
function renderEquipmentTable(items) {

    equipmentTable.innerHTML = "";

    if (items.length === 0) {

        equipmentTable.innerHTML = `
            <tr>
                <td colspan="7">No equipment found.</td>
            </tr>
        `;

        return;
    }

    items.forEach(item => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(item.equipmentId)}</td>
            <td>${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.category)}</td>
            <td>${escapeHTML(item.location)}</td>
            <td>${escapeHTML(item.condition)}</td>
            <td>${escapeHTML(item.status)}</td>
            <td>View Only</td>
        `;

        equipmentTable.appendChild(row);

    });

}

// Update Equipment Statistics
function updateEquipmentStats(items) {

    totalEquipment.textContent = items.length;

    availableEquipment.textContent =
        items.filter(item => item.status === "Available").length;

    borrowedEquipment.textContent =
        items.filter(item => item.status === "Borrowed").length;

}

// Live Equipment Listener
function startEquipmentListener() {

    const equipmentCollection = collection(db, "equipment");

    onSnapshot(equipmentCollection, (snapshot) => {

        allEquipment = snapshot.docs.map(document => ({
            ...document.data(),
            documentId: document.id
        }));

        renderEquipmentTable(allEquipment);

        updateEquipmentStats(allEquipment);

        console.log("Student inventory updated:", allEquipment);

    }, (error) => {

        console.error("Equipment loading error:", error);

        equipmentTable.innerHTML = `
            <tr>
                <td colspan="7">Unable to load equipment.</td>
            </tr>
        `;

    });

}

// Search Equipment
searchEquipment.addEventListener("input", () => {

    const searchValue = searchEquipment.value
        .trim()
        .toLowerCase();

    const filteredEquipment = allEquipment.filter(item => {

        return (
            String(item.equipmentId || "").toLowerCase().includes(searchValue) ||
            String(item.name || "").toLowerCase().includes(searchValue)
        );

    });

    renderEquipmentTable(filteredEquipment);

});

// Authentication and Authorization
onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.replace("index.html");
        return;

    }

    try {

        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {

            await signOut(auth);
            window.location.replace("index.html");
            return;

        }

        const userData = userDoc.data();

        if (
            userData.role !== "student" ||
            userData.active !== true ||
            userData.status !== "approved"
        ) {

            await signOut(auth);
            window.location.replace("index.html");
            return;

        }

        // Display Student Name
        studentName.textContent =
            `Welcome, ${userData.name || "Student"}`;

        // Start Equipment Listener
        startEquipmentListener();

        // Initialize QR Scanner
        initQrScanner(db);

    } catch (error) {

        console.error("Student dashboard error:", error);

        studentName.textContent =
            "Unable to load student profile.";

    }

});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {

    await signOut(auth);

    window.location.replace("index.html");

});
