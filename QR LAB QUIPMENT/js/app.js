
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDhdxo5xY_b3I7j5JSFZRFY6kO5jq5EMI0",
    authDomain: "qr-based-project.firebaseapp.com",
    projectId: "qr-based-project",
    storageBucket: "qr-based-project.firebasestorage.app",
    messagingSenderId: "495599145715",
    appId: "1:495599145715:web:b9d7d8cf532e294ee01d86",
    measurementId: "G-DB99HFJWBY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase initialized successfully!");

// Form elements
const loginSection = document.getElementById("loginSection");
const signupSection = document.getElementById("signupSection");

const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");

// Switch to Signup
showSignup?.addEventListener("click", (event) => {

    event.preventDefault();

    loginSection.style.display = "none";
    signupSection.style.display = "block";

});

// Switch to Login
showLogin?.addEventListener("click", (event) => {

    event.preventDefault();

    signupSection.style.display = "none";
    loginSection.style.display = "block";

});

// Student Signup
const signupForm = document.getElementById("signupForm");

if (signupForm) {

    signupForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const name = document.getElementById("signupName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        const signupMessage = document.getElementById("signupMessage");
        const signupBtn = document.getElementById("signupBtn");

        if (password !== confirmPassword) {

            signupMessage.textContent = "Passwords do not match.";
            return;

        }

        signupBtn.disabled = true;
        signupMessage.textContent = "Creating student account...";

        try {

            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {

                name: name,
                email: email,
                role: "student",
                active: false,
                status: "pending",
                createdAt: serverTimestamp()

            });

            await signOut(auth);

            signupMessage.textContent =
                "Registration successful! Please wait for admin approval.";

            signupForm.reset();

        } catch (error) {

            console.error("Signup error:", error);

            signupMessage.textContent = error.message;

        } finally {

            signupBtn.disabled = false;

        }

    });

}

// Login - Admin and Student
const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const selectedRole = document.getElementById("loginRole").value;
        const message = document.getElementById("message");
        const loginBtn = document.getElementById("loginBtn");

        loginBtn.disabled = true;
        message.textContent = "Verifying credentials...";

        try {

            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {

                await signOut(auth);
                throw new Error("User profile not found.");

            }

            const userData = userDoc.data();
            if (userData.role !== selectedRole) {
    await signOut(auth);
    throw new Error("Selected role does not match your account.");
}

            if (userData.active !== true) {

                await signOut(auth);

                throw new Error(
                    "Your account is pending admin approval."
                );

            }

            if (userData.role === "admin") {

                message.textContent = "Admin login successful!";

                window.location.href = "dashboard.html";

            } else if (userData.role === "student") {

                message.textContent = "Student login successful!";

                window.location.href = "student.html";

            } else {

                await signOut(auth);

                throw new Error("Invalid user role.");

            }

        } catch (error) {

            console.error("Login error:", error);
            message.textContent = error.message;

        } finally {

            loginBtn.disabled = false;

        }

    });

}
// Forgot Password Functionality

const forgotPasswordBtn =
    document.getElementById("forgotPassword");

if (forgotPasswordBtn) {

    forgotPasswordBtn.addEventListener("click", async (event) => {

        event.preventDefault();

        const email =
            document.getElementById("email").value.trim();

        const message =
            document.getElementById("message");

        if (!email) {
            message.textContent =
                "Please enter your registered email first.";
            return;
        }

        try {

            message.textContent = "Sending reset link...";

            await sendPasswordResetEmail(auth, email);

            message.textContent =
                "Password reset link sent! Check your inbox.";

        } catch (error) {

            console.error("Password reset error:", error);

            message.textContent =
                "Unable to send reset link. Please try again.";

        }
    });
}