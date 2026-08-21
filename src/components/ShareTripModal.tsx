"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ShareTripModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");
  const tripId = searchParams.get("tripId");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Only render if the URL parameter matches
  if (modal !== "share-trip" || !tripId) return null;

  const closeModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("modal");
    params.delete("tripId");
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // 1. Call the secure RPC function to find the user's UUID by email
      const { data: userId, error: userError } = await supabase.rpc("get_user_id_by_email", {
        lookup_email: email
      });

      if (userError || !userId) {
        setMessage({ text: "Nie znaleziono użytkownika. Upewnij się, że logował się już do aplikacji.", type: "error" });
        setLoading(false);
        return;
      }

      // 2. Insert the user into the trip_members table
      const { error: insertError } = await supabase
        .from("trip_members")
        .insert({ trip_id: tripId, user_id: userId, role: "viewer" });

      if (insertError) {
        // Handle Postgres unique constraint violation (error code 23505)
        if (insertError.code === "23505") {
          setMessage({ text: "Ten użytkownik ma już dostęp do tej wycieczki.", type: "error" });
        } else {
          setMessage({ text: "Nie udało się udostępnić wycieczki.", type: "error" });
        }
      } else {
        setMessage({ text: "Wycieczka udostępniona pomyślnie!", type: "success" });
        setEmail(""); // Clear the input after success
      }
    } catch (error) {
      setMessage({ text: "Wystąpił nieoczekiwany błąd.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Udostępnij wycieczkę</h2>
          <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            ✕
          </button>
        </div>

        {message.text && (
          <div className={`p-3 rounded-lg text-sm mb-4 font-medium border ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleShare} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail znajomego
            </label>
            <input
              type="email"
              required
              placeholder="np. jan@kowalski.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-2">
              Osoba ta musi najpierw zalogować się do aplikacji przynajmniej raz.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 cursor-pointer flex items-center gap-2"
            >
              {loading ? "Szukam..." : "Zaproś ✈️"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}