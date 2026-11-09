import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AdminProfile, CreatedLink, LinkRecord } from "../shared/types";
import { CreateLinkCard } from "./components/CreateLinkCard";
import { DeleteLinkDialog } from "./components/DeleteLinkDialog";
import { LinksCard } from "./components/LinksCard";
import { Topbar } from "./components/Topbar";
import { Toaster } from "./components/ui/sonner";
import { deleteLink, getLinks, getProfile } from "./lib/api";

/**
 * Copies text to the clipboard and says whether it worked.
 * @param text - The text to copy.
 */
const copy = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast.error("Could not copy; select the link and copy it manually");
  }
};

/** The admin panel: create short links, then copy, search and delete them. */
export const App = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [status, setStatus] = useState<string | null>("Loading…");
  const [latest, setLatest] = useState<CreatedLink | null>(null);
  const [deleting, setDeleting] = useState<LinkRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    Promise.all([getProfile(), getLinks()]).then(
      ([me, saved]) => {
        setProfile(me);
        setLinks(saved);
        setStatus(null);
      },
      () => setStatus("Could not load links. Refresh the page to try again."),
    );
  }, []);

  useEffect(() => {
    if (profile) {
      document.title = `${profile.brand} Links`;
    }
  }, [profile]);

  // KV lists can lag by up to a minute, so a new link is added locally instead of reloading the list.
  const created = (next: CreatedLink) => {
    setLinks((current) => [
      next.link,
      ...current.filter((item) => item.code !== next.link.code),
    ]);
    setLatest(next);
  };

  const askToDelete = (link: LinkRecord) => {
    setDeleting(link);
    setConfirmOpen(true);
  };

  const remove = async (link: LinkRecord) => {
    try {
      await deleteLink(link.code);
    } catch {
      toast.error("Could not delete the link");
      return;
    }
    setLinks((current) => current.filter((item) => item.code !== link.code));
    setLatest((current) => (current?.link.code === link.code ? null : current));
    toast(`Deleted ${link.code}`);
  };

  return (
    <>
      <Topbar profile={profile} />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-8 pb-16 sm:px-6">
        <CreateLinkCard latest={latest} onCreated={created} onCopy={copy} />
        <LinksCard
          links={links}
          status={status}
          onCopy={copy}
          onDelete={askToDelete}
        />
      </main>
      <DeleteLinkDialog
        link={deleting}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={remove}
      />
      <Toaster position="bottom-center" duration={2500} />
    </>
  );
};
