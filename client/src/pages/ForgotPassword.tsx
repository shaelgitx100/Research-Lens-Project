import { useState } from "react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const response = await fetch(
            "http://localhost:5000/api/auth/forgot-password",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            }
        );

        const data = await response.json();
        setMessage(data.message);
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Forgot Password?</h2>

            <p>
                Enter your registered email to receive
                a password reset link.
            </p>

            <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />

            <button type="submit">
                Send Reset Link
            </button>

            {message && <p>{message}</p>}
        </form>
    );
}