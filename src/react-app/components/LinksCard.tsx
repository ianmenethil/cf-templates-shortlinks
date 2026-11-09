import { Copy, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { shortUrl } from "../../shared/short-url";
import type { LinkRecord } from "../../shared/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { absoluteTime, formatAge } from "../lib/format-age";
import { IconButton } from "./IconButton";

/** Props for {@link LinksCard}. */
type LinksCardProps = {
  /** Every saved link, newest first. */
  links: LinkRecord[];
  /** What to say instead of the table: loading, an error, or `null` once the links are in. */
  status: string | null;
  /** Copies a short link to the clipboard. */
  onCopy: (shortUrl: string) => void;
  /** Asks to delete a link; the person confirms before it goes. */
  onDelete: (link: LinkRecord) => void;
};

/** Classes shared by the table's text header cells. */
const HEAD_CELL =
  "h-9 text-xs font-medium tracking-wide text-muted-foreground uppercase";

/** The searchable table of saved links, with copy and delete buttons on each row. */
export const LinksCard = ({
  links,
  status,
  onCopy,
  onDelete,
}: LinksCardProps) => {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? links.filter((link) =>
        [link.code, link.url, link.createdBy].some((value) =>
          value.toLowerCase().includes(needle),
        ),
      )
    : links;
  const message =
    status ??
    (links.length === 0
      ? "No links yet. Create your first one above."
      : visible.length === 0
        ? "No links match your search."
        : null);

  return (
    <Card role="region" aria-labelledby="links-heading">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          <h2 id="links-heading" className="flex items-center gap-2">
            Links
            {links.length > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {links.length}
              </Badge>
            )}
          </h2>
        </CardTitle>
        <label className="sr-only" htmlFor="search-input">
          Search links
        </label>
        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="search-input"
            className="pl-8"
            type="search"
            placeholder="Search code, URL or creator"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {message && (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {message}
          </p>
        )}
        {!message && (
          <Table className="max-sm:block">
            <TableHeader className="bg-muted/60 max-sm:hidden">
              <TableRow className="hover:bg-transparent">
                <TableHead className={`rounded-l-md pl-3 ${HEAD_CELL}`}>
                  Code
                </TableHead>
                <TableHead className={HEAD_CELL}>Destination</TableHead>
                <TableHead className={HEAD_CELL}>Created</TableHead>
                <TableHead className="h-9 rounded-r-md pr-3 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="max-sm:block">
              {visible.map((link) => {
                const href = shortUrl(location.origin, link.code);
                return (
                  <TableRow
                    key={link.code}
                    className="max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:gap-x-3 max-sm:py-3"
                  >
                    <TableCell className="pl-3 font-mono font-semibold max-sm:col-start-1 max-sm:p-0">
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={href}
                        target="_blank"
                        rel="noopener"
                      >
                        {link.code}
                      </a>
                    </TableCell>
                    <TableCell
                      className="w-[55%] max-w-0 text-muted-foreground max-sm:col-span-2 max-sm:row-start-2 max-sm:w-full max-sm:max-w-none max-sm:p-0 max-sm:pt-1"
                      title={link.url}
                    >
                      <span className="block truncate">{link.url}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap max-sm:col-span-2 max-sm:row-start-3 max-sm:flex max-sm:items-center max-sm:gap-2 max-sm:p-0 max-sm:pt-1">
                      <span
                        className="block text-sm"
                        title={absoluteTime.format(new Date(link.createdAt))}
                      >
                        {formatAge(link.createdAt)}
                      </span>
                      {link.createdBy === "api" ? (
                        <Badge variant="outline" className="mt-1 font-mono text-[0.7rem] max-sm:mt-0">
                          api
                        </Badge>
                      ) : (
                        <span className="block text-xs text-muted-foreground">
                          {link.createdBy}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-px pr-3 text-right whitespace-nowrap max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label={`Copy ${link.code}`}
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onCopy(href)}
                        >
                          <Copy />
                        </IconButton>
                        <IconButton
                          label={`Delete ${link.code}`}
                          variant="ghost"
                          size="icon-sm"
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onDelete(link)}
                        >
                          <Trash2 />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
