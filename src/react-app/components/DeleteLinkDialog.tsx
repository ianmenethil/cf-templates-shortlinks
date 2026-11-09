import type { LinkRecord } from "../../shared/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Props for {@link DeleteLinkDialog}. */
type DeleteLinkDialogProps = {
  /** The link to ask about; kept while the dialog is closed so its text does not blank out. */
  link: LinkRecord | null;
  /** Whether the dialog is showing. */
  open: boolean;
  /** Called with the new state when the person cancels, confirms or presses Escape. */
  onOpenChange: (open: boolean) => void;
  /** Called when the person confirms the delete. */
  onConfirm: (link: LinkRecord) => void;
};

/** Asks the person to confirm before a link is deleted; Cancel has focus and Escape cancels. */
export const DeleteLinkDialog = ({
  link,
  open,
  onOpenChange,
  onConfirm,
}: DeleteLinkDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {link?.code}?</AlertDialogTitle>
        <AlertDialogDescription>
          Anyone who opens this link will get &ldquo;not found&rdquo;.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          onClick={() => {
            if (link) {
              onConfirm(link);
            }
          }}
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
