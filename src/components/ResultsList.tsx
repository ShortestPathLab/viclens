import {
  Alert,
  Button,
  Description,
  EmptyState,
  Label,
  ListBox,
  Skeleton,
  Typography,
} from "@heroui/react";
import { orderBy } from "es-toolkit";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { SearchX } from "lucide-react";
import { useMemo } from "react";
import { formatNumber, typeNames } from "../data";
import { useSchoolsQuery } from "../queries";
import {
  PAGE_SIZE,
  resultLimitAtom,
  selectSchoolAtom,
  selectedSchoolAtom,
} from "../state/atoms";
import { useVisibleSchools } from "../state/hooks";
import { cssRgb, typeColorsAtom } from "../state/palette";

export default function ResultsList() {
  const schools = useSchoolsQuery();
  const typeColors = useAtomValue(typeColorsAtom);
  const selected = useAtomValue(selectedSchoolAtom);
  const visible = useVisibleSchools();
  const [limit, setLimit] = useAtom(resultLimitAtom);
  const selectSchool = useSetAtom(selectSchoolAtom);
  const ranked = useMemo(
    () =>
      orderBy(
        visible,
        [(s) => s.enrolment ?? -1, (s) => s.name],
        ["desc", "asc"],
      ),
    [visible],
  );
  return (
    <section aria-label="Results">
      {schools.isLoading && (
        <div className="grid grid-cols-1 gap-3" aria-label="Loading schools">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      )}
      {schools.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>Schools did not load</Alert.Title>
            <Alert.Description>
              The school data file could not be fetched.
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="ghost" onPress={() => schools.refetch()}>
            Try again
          </Button>
        </Alert>
      )}
      {schools.isSuccess && !visible.length && (
        <EmptyState className="flex flex-col items-center gap-2 py-6">
          <SearchX size={22} className="text-muted" />
          <Typography type="h6">No schools match</Typography>
          <Typography type="body-sm" color="muted">
            Try another name, or widen the filters.
          </Typography>
        </EmptyState>
      )}
      {/* A listbox rather than a stack of buttons: arrow keys move through the results, and the
          open school stays marked while its detail is on screen. */}
      <ListBox
        // The listbox insets its items by its own padding plus theirs. Pulling that back lines the
        // item text up with the fields above it, and lets the hover shape sit a little wider.
        // `w-auto` lets the negative margins widen the box; the component ships `w-full`, which
        // would keep it at the container width and leave the pulled-back space empty on the end.
        className="-mx-3 w-auto"
        aria-label="School results"
        items={ranked.slice(0, limit)}
        selectionMode="single"
        selectedKeys={selected ? [selected.id] : []}
        onSelectionChange={(keys) => {
          const id = [...keys][0];
          const school = ranked.find((s) => s.id === id);
          if (school) selectSchool(school);
        }}
      >
        {(s) => (
          <ListBox.Item id={s.id} textValue={s.name} className="school-row">
            {/* The category swatch is the one piece with no component of its own. */}
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ background: cssRgb(typeColors[s.type]) }}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <Label className="truncate">{s.name}</Label>
              <Description className="truncate">
                {s.town} · {typeNames[s.type] ?? s.type}
              </Description>
            </div>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        )}
      </ListBox>
      {limit < ranked.length && (
        <Button
          className="mt-3 w-full"
          variant="ghost"
          size="sm"
          onPress={() => setLimit((v) => v + PAGE_SIZE)}
        >
          Show {formatNumber(Math.min(PAGE_SIZE, ranked.length - limit))} more
        </Button>
      )}
    </section>
  );
}
