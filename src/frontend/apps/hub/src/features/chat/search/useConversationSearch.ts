import { useEffect, useState } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Chat } from "@/features/drivers/types";

import { decorateChat } from "../chatRefs";
import { compareChats } from "../chatSorting";

import { normalizeSearch } from "./model";

type Result = { chat: Chat; subtitle: string; accountLabel: string };
const PAGE_SIZE = 40;

export const useConversationSearch = () => {
  const entries = useDriverEntries();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasQuery = !!normalizeSearch(query);
  const accounts = entries.filter(
    ({ driver }) => driver.supportsConversationSearch,
  );
  const statuses = accounts.map(({ driver }) =>
    driver.getConversationSearchStatus(),
  );
  const partial = statuses.some(
    (status) =>
      status.freshness !== "current" ||
      status.hasUnknownRooms ||
      status.ready < status.eligible,
  );

  useEffect(() => {
    const unsubscribes = entries.map(({ driver }) =>
      driver.subscribeToEvents((event) => {
        if (event.type === "search:changed") setRevision((value) => value + 1);
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [entries]);

  useEffect(() => {
    const controller = new AbortController();
    if (!normalizeSearch(query)) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    setFailed(false);
    void Promise.allSettled(
      entries
        .filter(({ driver }) => driver.supportsConversationSearch)
        .map(async (entry) => {
          const page = await entry.driver.searchConversations({
            query,
            limit,
            signal: controller.signal,
          });
          return {
            total: page.total,
            results: page.results.map(({ chat, subtitle }) => ({
              chat: decorateChat(entry.accountId, chat),
              subtitle,
              accountLabel: entry.label,
            })),
          };
        }),
    )
      .then((settled) => {
        if (controller.signal.aborted) return;
        const pages = settled.flatMap((page) =>
          page.status === "fulfilled" ? [page.value] : [],
        );
        setFailed(settled.some((page) => page.status === "rejected"));
        setResults(
          pages
            .flatMap((page) => page.results)
            .sort((a, b) => compareChats(a.chat, b.chat))
            .slice(0, limit),
        );
        setTotal(pages.reduce((sum, page) => sum + page.total, 0));
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [entries, query, limit, revision]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setLimit(PAGE_SIZE);
    setResults([]);
    setTotal(0);
  };

  const loadMore = () => setLimit((value) => value + PAGE_SIZE);

  return {
    query,
    changeQuery,
    loadMore,
    hasQuery,
    accounts,
    statuses,
    partial,
    results,
    total,
    loading,
    failed,
  };
};
