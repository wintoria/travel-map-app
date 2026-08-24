"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
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
    } catch {
      setMessage({ text: "Wystąpił nieoczekiwany błąd.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={closeModal} title="Udostępnij wycieczkę" maxWidth="max-w-md" zIndex="z-[60]">
      <div className="p-6">
        {message.text && (
          <div className={`p-3 rounded-lg text-sm mb-4 font-medium border ${message.type === 'error' ? 'bg-error/15 text-error border-error/40' : 'bg-success/15 text-success border-success/40'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleShare} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">
              E-mail znajomego
            </label>
            <input
              type="email"
              required
              placeholder="np. jan@kowalski.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary"
            />
            <p className="text-xs text-muted mt-2">
              Osoba ta musi najpierw zalogować się do aplikacji przynajmniej raz.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="ghost" onClick={closeModal} className="px-4">
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={loading} className="px-4">
              {loading ? "Szukam..." : (
                <>
                  Zaproś <Send size={16} />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
