import { Copy } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { CreatedLink } from "../../shared/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createLink } from "../lib/api";
import { IconButton } from "./IconButton";

/** Props for {@link CreateLinkCard}. */
type CreateLinkCardProps = {
  /** The link created most recently, shown under the form. */
  latest: CreatedLink | null;
  /** Called with the new link once the API has saved it. */
  onCreated: (created: CreatedLink) => void;
  /** Copies a short link to the clipboard. */
  onCopy: (shortUrl: string) => void;
};

/** The form that turns a destination URL into a short link, and the short link it just made. */
export const CreateLinkCard = ({
  latest,
  onCreated,
  onCopy,
}: CreateLinkCardProps) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      onCreated(await createLink(url.trim()));
      setUrl("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create the link.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card role="region" aria-labelledby="create-heading">
      <CardHeader>
        <CardTitle>
          <h1 id="create-heading">Create a short link</h1>
        </CardTitle>
        <CardDescription>
          Paste the full address the short link should open.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <form
          className="flex gap-2 max-sm:flex-col"
          onSubmit={submit}
          noValidate
        >
          <label className="sr-only" htmlFor="url-input">
            Destination URL
          </label>
          <Input
            id="url-input"
            name="url"
            type="url"
            required
            placeholder="https://ianmenethil.com/blog/hello-world?utm_source=newsletter"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" className="shrink-0 sm:px-5" disabled={pending}>
            Create link
          </Button>
        </form>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {latest && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 py-2 pr-2 pl-3.5">
            <span className="shrink-0 text-sm font-medium text-muted-foreground">
              Short link
            </span>
            <a
              className="min-w-0 flex-1 truncate font-mono font-semibold text-primary underline-offset-4 hover:underline"
              href={latest.shortUrl}
              target="_blank"
              rel="noopener"
            >
              {latest.shortUrl}
            </a>
            <IconButton
              label="Copy short link"
              onClick={() => onCopy(latest.shortUrl)}
            >
              <Copy />
            </IconButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
