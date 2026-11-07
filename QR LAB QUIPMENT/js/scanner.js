
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export function initQrScanner(db) {

    const openScannerBtn = document.getElementById("openScannerBtn");
    const scannerModal = document.getElementById("scannerModal");
    const closeScannerBtn = document.getElementById("closeScannerBtn");
    const stopScannerBtn = document.getElementById("stopScannerBtn");

    const scannerStatus = document.getElementById("scannerStatus");
    const scanResult = document.getElementById("scanResult");

    let scanner = null;
    let isStarting = false;
    let isProcessing = false;

    // Stop camera scanner
    async function stopScanner() {

        if (!scanner) return;

        const currentScanner = scanner;
        scanner = null;

        try {
            if (currentScanner.isScanning) {
                await currentScanner.stop();
            }

            currentScanner.clear();

        } catch (error) {
            console.error("Scanner stop error:", error);
        }
    }

    // Fetch equipment from Firestore
    async function fetchEquipment(equipmentId) {

        try {

            const equipmentRef = doc(db, "equipment", equipmentId);
            const equipmentDoc = await getDoc(equipmentRef);

            if (!equipmentDoc.exists()) {

                scanResult.textContent =
                    "Equipment not found in database.";

                scannerStatus.textContent =
                    "No matching equipment found.";

                return;
            }

            const equipment = equipmentDoc.data();

            const card = document.createElement("div");
            card.className = "scan-result-card";

            const title = document.createElement("h3");
            title.textContent = equipment.name || "Unnamed Equipment";

            card.appendChild(title);

            const fields = [
                ["Equipment ID", equipment.equipmentId],
                ["Category", equipment.category],
                ["Location", equipment.location],
                ["Condition", equipment.condition],
                ["Status", equipment.status]
            ];

            fields.forEach(([label, value]) => {

                const row = document.createElement("p");

                row.textContent =
                    `${label}: ${value ?? "Not available"}`;

                card.appendChild(row);

            });

            scanResult.replaceChildren(card);

            scannerStatus.textContent =
                "Equipment found successfully!";

        } catch (error) {

            console.error("Equipment lookup error:", error);

            scannerStatus.textContent =
                "Unable to fetch equipment details.";
        }
    }

    // Start camera
    async function startScanner() {

        if (isStarting || scanner) return;

        if (!window.Html5Qrcode) {

            scannerStatus.textContent =
                "QR Scanner library failed to load.";

            return;
        }

        isStarting = true;
        isProcessing = false;

        scannerStatus.textContent =
            "Requesting camera permission...";

        scanResult.innerHTML = "";

        try {

            scanner = new window.Html5Qrcode("qr-reader");

            await scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 220, height: 220 }
                },

                async (decodedText) => {

                    if (isProcessing) return;

                    isProcessing = true;

                    await stopScanner();

                    const equipmentId =
                        decodedText.trim().toUpperCase();

                    scannerStatus.textContent =
                        "QR scanned! Fetching equipment...";

                    await fetchEquipment(equipmentId);

                },

                () => {}
            );

            scannerStatus.textContent =
                "Camera active. Scan an equipment QR code.";

        } catch (error) {

            console.error("Camera error:", error);

            scannerStatus.textContent =
                "Unable to access camera. Check camera permission.";

            await stopScanner();

        } finally {

            isStarting = false;
        }
    }

    // Open scanner modal
    openScannerBtn.addEventListener("click", async () => {

        scannerModal.style.display = "flex";

        await startScanner();

    });

    // Close scanner modal
    closeScannerBtn.addEventListener("click", async () => {

        await stopScanner();

        scannerModal.style.display = "none";

    });

    // Stop scanner button
    stopScannerBtn.addEventListener("click", async () => {

        await stopScanner();

        scannerStatus.textContent = "Scanner stopped.";

    });

    // Close modal by clicking outside
    scannerModal.addEventListener("click", async (event) => {

        if (event.target === scannerModal) {

            await stopScanner();

            scannerModal.style.display = "none";
        }

    });

}
