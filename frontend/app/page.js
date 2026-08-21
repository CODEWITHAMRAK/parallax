"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function Home() {
  const { data: session, status } = useSession();
  const [backendMessage, setBackendMessage] = useState("");

  const testBackendApi = async () => {
    try {
      const res = await apiFetch("/api/me");
      const data = await res.json();
      setBackendMessage(JSON.stringify(data, null, 2));
    } catch (error) {
      setBackendMessage("Error connecting to backend API: " + error.message);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">CodeFury Authentication</h1>
      
      {status === "loading" ? (
        <p>Loading...</p>
      ) : session ? (
        <div className="flex flex-col items-center gap-4">
          <p>Welcome, {session.user.name}</p>
          <img src={session.user.image} alt="User Avatar" className="w-16 h-16 rounded-full" />
          
          <div className="flex gap-4">
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Sign out
            </button>
            <button
              onClick={testBackendApi}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Test Backend API
            </button>
          </div>

          {backendMessage && (
            <pre className="mt-4 p-4 bg-gray-800 text-green-400 rounded w-full max-w-lg overflow-x-auto text-sm">
              {backendMessage}
            </pre>
          )}

          <div className="mt-8 p-4 bg-gray-800 rounded w-full max-w-lg overflow-x-auto">
            <h2 className="text-xl font-semibold mb-2 text-white">Session Data:</h2>
            <pre className="text-xs text-gray-300">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <button
          onClick={() => signIn("google")}
          className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition"
        >
          Sign in with Google
        </button>
      )}
    </main>
  );
}
