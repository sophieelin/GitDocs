<script setup lang="ts">
import { markdown } from "@codemirror/lang-markdown";
import { Annotation, EditorState, StateEffect, StateField, type ChangeDesc, type EditorSelection, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SuggestedRange, TextRange } from "./SourceView.vue";

/** A run of edits not yet saved as a suggestion: the text of the file it replaces, and with what. */
export interface Draft {
  key: number;
  range: Required<TextRange>;
  original: string;
  replacement: string;
}

/**
 * A file, editable as in a document's suggesting mode: every run of edits is
 * kept apart from the file's own text, its removed text struck through and
 * its new text in [brackets]. Saved suggestions are green and locked; edits
 * not yet saved are blue and numbered, and `drafts` is emitted whenever they
 * change. A suggestion added to `suggestions` takes the place of its draft;
 * one taken out of it puts the file's text back.
 *
 * The file's text must not change while this is open; give it a `key`.
 */
const props = defineProps<{ text: string; suggestions: (SuggestedRange & { highlight: string })[] }>();
const emit = defineEmits<{ drafts: [drafts: Draft[]] }>();

const original = props.text;
const lineStarts = [0];
for (let index = original.indexOf("\n"); index !== -1; index = original.indexOf("\n", index + 1)) lineStarts.push(index + 1);

/** Where a line and character are in the file, as `applySuggestions` reads them. */
function offset(line: number, column: number): number {
  const end = line < lineStarts.length ? lineStarts[line] - 1 : original.length;
  return Math.min((lineStarts[line - 1] ?? original.length) + column, end);
}

function point(at: number): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (lineStarts[middle] <= at) low = middle;
    else high = middle - 1;
  }
  return { line: low + 1, column: at - lineStarts[low] };
}

function rangeOf(from: number, to: number): Required<TextRange> {
  const first = point(from);
  const last = point(to);
  return { from: first.line, to: last.line, start: first.column, end: last.column };
}

/**
 * Text of the editor from `from` to `to` that stands for the file's text from
 * `origFrom` to `origTo`; outside regions, the two are the same. `saved` is the
 * suggestion it is, or null for a draft.
 */
interface Region {
  key: number;
  from: number;
  to: number;
  origFrom: number;
  origTo: number;
  saved: string | null;
}

let nextKey = 1;
const byPosition = (a: Region, b: Region) => a.from - b.from || a.to - b.to;
/** How much longer a region is in the editor than in the file. */
const growth = (region: Region) => region.to - region.from - (region.origTo - region.origFrom);

const setRegions = StateEffect.define<Region[]>();
/** Changes made here rather than typed, which are not tracked or undone. */
const programmatic = Annotation.define<boolean>();

/**
 * The regions after typed changes: each change joins the drafts it touches into
 * one, and a draft whose text is the file's again is dropped. Saved regions are
 * never changed (see the change filter).
 */
function track(list: Region[], changes: ChangeDesc, doc: Text): Region[] {
  let current = list;
  const grown = new Set<number>();
  changes.iterChangedRanges((fromA, toA) => {
    const touched = current.filter((region) => region.saved === null && region.from <= toA && region.to >= fromA);
    const others = current.filter((region) => !touched.includes(region));
    const shift = others.filter((region) => region.to <= fromA).reduce((sum, region) => sum - growth(region), 0);
    const first = touched[0];
    const last = touched[touched.length - 1];
    const joined: Region = {
      key: first?.key ?? nextKey++,
      from: first && first.from < fromA ? first.from : fromA,
      to: last && last.to > toA ? last.to : toA,
      origFrom: first && first.from <= fromA ? first.origFrom : fromA + shift,
      origTo: last && last.to >= toA ? last.origTo : toA + shift - touched.reduce((sum, region) => sum + growth(region), 0),
      saved: null,
    };
    grown.add(joined.key);
    current = [...others, joined].sort(byPosition);
  });
  return current
    .map((region) => {
      // A changed region takes in text typed at its edges; the others keep to their own.
      if (grown.has(region.key)) return { ...region, from: changes.mapPos(region.from, -1), to: changes.mapPos(region.to, 1) };
      const from = changes.mapPos(region.from, 1);
      return { ...region, from, to: Math.max(from, changes.mapPos(region.to, -1)) };
    })
    .filter((region) => region.saved !== null || doc.sliceString(region.from, region.to) !== original.slice(region.origFrom, region.origTo));
}

/** The editor's text to start with: the file with every saved suggestion made. */
function initial(): { doc: string; list: Region[] } {
  const sorted = props.suggestions
    .map((suggestion) => ({ suggestion, origFrom: offset(suggestion.from, suggestion.start), origTo: offset(suggestion.to, suggestion.end) }))
    .sort((a, b) => a.origFrom - b.origFrom || a.origTo - b.origTo);
  let doc = "";
  let at = 0;
  const list: Region[] = [];
  for (const { suggestion, origFrom, origTo } of sorted) {
    if (origFrom < at) continue;
    doc += original.slice(at, origFrom);
    const from = doc.length;
    doc += suggestion.replacement;
    list.push({ key: nextKey++, from, to: doc.length, origFrom, origTo, saved: suggestion.highlight });
    at = origTo;
  }
  return { doc: doc + original.slice(at), list };
}

const regions = StateField.define<Region[]>({
  create: () => [],
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setRegions)) return effect.value;
    return transaction.docChanged ? track(value, transaction.changes, transaction.state.doc) : value;
  },
});

/** The edge of a region: the removed text struck through and "[", or "]" with the draft's number. */
class Edge extends WidgetType {
  constructor(
    readonly removed: string,
    readonly bracket: string,
    readonly label: string,
    readonly tone: string,
  ) {
    super();
  }

  eq(other: Edge): boolean {
    return other.removed === this.removed && other.bracket === this.bracket && other.label === this.label && other.tone === this.tone;
  }

  toDOM(): HTMLElement {
    const edge = document.createElement("span");
    edge.className = `cm-edge cm-${this.tone}`;
    if (this.removed) {
      const removed = edge.appendChild(document.createElement("del"));
      removed.textContent = this.removed;
    }
    if (this.bracket) edge.append(this.bracket);
    if (this.label) {
      const label = edge.appendChild(document.createElement("sup"));
      label.textContent = this.label;
    }
    return edge;
  }
}

const decorations = EditorView.decorations.compute([regions], (state) => {
  const marks = [];
  let drafts = 0;
  for (const region of state.field(regions)) {
    const tone = region.saved === null ? "draft" : "saved";
    const label = region.saved === null ? String(++drafts) : "";
    const removed = original.slice(region.origFrom, region.origTo);
    if (region.from === region.to) {
      marks.push(Decoration.widget({ widget: new Edge(removed, "", label, tone), side: -1 }).range(region.from));
      continue;
    }
    marks.push(Decoration.widget({ widget: new Edge(removed, "[", "", tone), side: -1 }).range(region.from));
    marks.push(Decoration.mark({ class: `cm-inserted cm-${tone}` }).range(region.from, region.to));
    marks.push(Decoration.widget({ widget: new Edge("", "]", label, tone), side: 1 }).range(region.to));
  }
  return Decoration.set(marks, true);
});

// A saved suggestion is locked; to change it, remove it and suggest again.
const locked = EditorState.changeFilter.of((transaction) => {
  if (transaction.annotation(programmatic)) return true;
  const spans = transaction.startState
    .field(regions)
    .filter((region) => region.saved !== null && region.from < region.to)
    .flatMap((region) => [region.from, region.to]);
  return spans.length === 0 ? true : spans;
});

function draftsOf(state: EditorState): Draft[] {
  return state
    .field(regions)
    .filter((region) => region.saved === null)
    .map((region) => ({
      key: region.key,
      range: rangeOf(region.origFrom, region.origTo),
      original: original.slice(region.origFrom, region.origTo),
      replacement: state.doc.sliceString(region.from, region.to),
    }));
}

const host = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

function stateOf(doc: string | Text, list: Region[], selection?: EditorSelection): EditorState {
  return EditorState.create({
    doc,
    selection,
    extensions: [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      regions.init(() => list),
      decorations,
      locked,
      EditorView.updateListener.of((update) => {
        if (update.startState.field(regions) !== update.state.field(regions)) emit("drafts", draftsOf(update.state));
      }),
    ],
  });
}

/**
 * Starts the undo history afresh. Undoing is not held back by the change
 * filter, so it must not reach back past a suggestion being saved or removed.
 */
function settle() {
  if (!view) return;
  const { doc, selection } = view.state;
  view.setState(stateOf(doc, view.state.field(regions), selection));
  emit("drafts", draftsOf(view.state));
}

onMounted(() => {
  const { doc, list } = initial();
  view = new EditorView({ parent: host.value!, state: stateOf(doc, list) });
  view.focus();
});

onBeforeUnmount(() => view?.destroy());

/** Replaces text of the editor that is a whole region or outside every region, and sets the regions after it. */
function rewrite(from: number, to: number, insert: string, update: (list: Region[]) => Region[]) {
  if (!view) return;
  const delta = insert.length - (to - from);
  const moved = view.state
    .field(regions)
    .map((region) => (region.to <= from ? region : region.from >= to ? { ...region, from: region.from + delta, to: region.to + delta } : region));
  view.dispatch({
    changes: { from, to, insert },
    effects: setRegions.of(update(moved).sort(byPosition)),
    annotations: programmatic.of(true),
  });
}

/** Puts the file's text back in place of a region. */
function revert(key: number) {
  const region = view?.state.field(regions).find((candidate) => candidate.key === key);
  if (!region) return;
  rewrite(region.from, region.to, original.slice(region.origFrom, region.origTo), (list) => list.filter((other) => other.key !== key));
}

function discard(key: number) {
  revert(key);
  settle();
}

/** Whether two ranges of the file share a character, or both put text in at one point. */
function clash(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  if (aFrom === aTo && bFrom === bTo) return aFrom === bFrom;
  return aFrom < bTo && bFrom < aTo;
}

// Saved suggestions follow the proposal: a new one takes the place of its draft, or is made
// here if it was saved elsewhere; a removed one puts the file's text back.
watch(
  () => props.suggestions,
  (suggestions) => {
    if (!view) return;
    const before = view.state.field(regions);
    const wanted = new Set(suggestions.map((suggestion) => suggestion.highlight));
    for (const region of before) if (region.saved !== null && !wanted.has(region.saved)) revert(region.key);
    for (const suggestion of suggestions) {
      const list = view.state.field(regions);
      if (list.some((region) => region.saved === suggestion.highlight)) continue;
      const origFrom = offset(suggestion.from, suggestion.start);
      const origTo = offset(suggestion.to, suggestion.end);
      const draft = list.find(
        (region) =>
          region.saved === null &&
          region.origFrom === origFrom &&
          region.origTo === origTo &&
          view!.state.doc.sliceString(region.from, region.to) === suggestion.replacement,
      );
      if (draft) {
        view.dispatch({ effects: setRegions.of(list.map((region) => (region === draft ? { ...region, saved: suggestion.highlight } : region))) });
        continue;
      }
      // One that clashes with a draft is left out until the draft is saved or discarded.
      if (list.some((region) => clash(region.origFrom, region.origTo, origFrom, origTo))) continue;
      const shift = list.filter((region) => region.origTo <= origFrom).reduce((sum, region) => sum + growth(region), 0);
      const from = origFrom + shift;
      rewrite(from, origTo + shift, suggestion.replacement, (moved) => [
        ...moved,
        { key: nextKey++, from, to: from + suggestion.replacement.length, origFrom, origTo, saved: suggestion.highlight },
      ]);
    }
    if (view.state.field(regions) !== before) settle();
  },
);

defineExpose({ discard });
</script>

<template>
  <div ref="host" class="editor" />
</template>

<style scoped>
.editor {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.editor :deep(.cm-editor) {
  max-height: 70vh;
  font-size: 13px;
}

.editor :deep(.cm-scroller) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.5;
}

/* Removed text struck through in red, new text in brackets in the accent color; unsaved ones are numbered. */
.editor :deep(.cm-edge del) {
  background: #fee2e2;
  color: #991b1b;
  white-space: pre-wrap;
}

.editor :deep(.cm-edge),
.editor :deep(.cm-inserted) {
  color: var(--accent);
  font-weight: 600;
}

.editor :deep(.cm-edge sup) {
  margin-left: 1px;
  font-size: 10px;
}
</style>
