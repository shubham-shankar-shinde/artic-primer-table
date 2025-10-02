import React, { useEffect, useState, useMemo } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Sidebar } from "primereact/sidebar";
import { InputNumber } from "primereact/inputnumber";
import { Paginator } from "primereact/paginator";
import type { Artwork } from "../types";
import { fetchArtworksPage } from "../api";

type SelectionMap = Record<number, Artwork>;

const STORAGE_KEY = "selected_artworks_map_v1";

export default function ArtworksTable() {
  const [page, setPage] = useState<number>(1); // 1-based
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Artwork[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // selectedIds stored in a map id->Artwork (only selected rows kept)
  const [selectedMap, setSelectedMap] = useState<SelectionMap>({});
  const [visibleSidebar, setVisibleSidebar] = useState(false);

  // selection for current page's DataTable (array of Artwork)
  const [pageSelection, setPageSelection] = useState<Artwork[] | null>(null);

  // Load persisted selection from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SelectionMap;
        setSelectedMap(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist selection whenever selectedMap changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedMap));
  }, [selectedMap]);

  // Fetch page data whenever page or rowsPerPage changes
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchArtworksPage(page, rowsPerPage)
      .then(({ items, total }) => {
        if (!mounted) return;
        setItems(items);
        setTotalRecords(total);
        // For current page, compute selection array of artworks that are selected
        const sel = items.filter((it) => selectedMap[it.id] !== undefined);
        setPageSelection(sel.length ? sel : null);
      })
      .catch((err) => {
        console.error(err);
        setItems([]);
        setTotalRecords(0);
        setPageSelection(null);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page, rowsPerPage, selectedMap]);

  // Helper: toggle selection of a row
  const toggleRow = (row: Artwork, checked: boolean) => {
    setSelectedMap((prev) => {
      const copy: SelectionMap = { ...prev };
      if (checked) {
        copy[row.id] = row;
      } else {
        delete copy[row.id];
      }
      return copy;
    });
  };

  // When DataTable selection changes (checkbox uses object equality),
  // use the event to add/remove from selectedMap
  const onSelectionChange = (e: { value: Artwork[] }) => {
    const newSelection = e.value ?? [];
    // Build a set of ids that are currently selected in the page selection
    const newIds = new Set<number>(newSelection.map((r) => r.id));
    // Compare with current page items to see which were toggled
    const pageIds = items.map((it) => it.id);

    setSelectedMap((prev) => {
      const next = { ...prev };
      // For each item on this page:
      for (const id of pageIds) {
        const found = newIds.has(id);
        const existed = prev[id] !== undefined;
        if (found && !existed) {
          // add
          const row = items.find((it) => it.id === id);
          if (row) next[id] = row;
        } else if (!found && existed) {
          // remove
          delete next[id];
        }
      }
      return next;
    });

    setPageSelection(newSelection.length ? newSelection : null);
  };

  // Select all rows on the current page
  const onSelectAllPage = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const row of items) next[row.id] = row;
      return next;
    });
    setPageSelection(items.length ? items : null);
  };

  // Deselect all on the current page
  const onDeselectAllPage = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const row of items) delete next[row.id];
      return next;
    });
    setPageSelection(null);
  };

  // Handler to remove item from selection from the custom panel
  const removeFromSelection = (id: number) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Derived: selection array for DataTable to show selected rows on current page
  const dtSelection = useMemo(() => {
    return items.filter((it) => selectedMap[it.id] !== undefined);
  }, [items, selectedMap]);

  // Formatters for columns
  const renderDates = (row: Artwork) => {
    const s = row.date_start ?? "";
    const e = row.date_end ?? "";
    if (s === e || !s || !e) return s || e || "-";
    return `${s} — ${e}`;
  };

  return (
    <div className="card container">
      <h2>Art Institute - Artworks</h2>

      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Button icon="pi pi-list" label={`Selected: ${Object.keys(selectedMap).length}`} onClick={() => setVisibleSidebar(true)} />
        <Button label="Select all on page" onClick={onSelectAllPage} />
        <Button label="Deselect all on page" onClick={onDeselectAllPage} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label>Rows per page:</label>
          <InputNumber value={rowsPerPage} onValueChange={(e) => { const val = e.value ?? 10; setRowsPerPage(Number(val)); setPage(1); }} mode="decimal" showButtons min={5} max={100} />
        </div>
      </div>

      <DataTable
        value={items}
        lazy
        paginator={false} // we use Paginator separately because we do server-side requests
        selection={dtSelection}
        onSelectionChange={(e) => onSelectionChange(e as any)}
        dataKey="id"
        loading={loading}
        showGridlines
        responsiveLayout="scroll"
        selectionMode="checkbox"
        emptyMessage="No records found"
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
        <Column field="title" header="Title" sortable></Column>
        <Column field="place_of_origin" header="Place of origin"></Column>
        <Column field="artist_display" header="Artist"></Column>
        <Column field="inscriptions" header="Inscription"></Column>
        <Column header="Dates" body={renderDates}></Column>
      </DataTable>

      <Paginator
        first={(page - 1) * rowsPerPage}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPageChange={(e) => {
          // Paginator emits zero-based 'page' index
          const newPage = (e.page ?? 0) + 1;
          setPage(newPage);
        }}
        template="PrevPageLink PageLinks NextPageLink RowsPerPageDropdown"
      />

      <Sidebar visible={visibleSidebar} onHide={() => setVisibleSidebar(false)} position="right" style={{ width: '30rem' }}>
        <h3>Selected Artworks ({Object.keys(selectedMap).length})</h3>
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
          {Object.keys(selectedMap).length === 0 && <div>No items selected.</div>}
          {Object.values(selectedMap).map((a) => (
            <div key={a.id} className="selected-item">
              <div style={{ flex: 1 }}>
                <div className="selected-title">{a.title ?? '(untitled)'}</div>
                <div className="selected-sub">{a.artist_display ?? a.place_of_origin ?? ''}</div>
              </div>
              <Button icon="pi pi-times" className="p-button-text" onClick={() => removeFromSelection(a.id)} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Button label="Close" onClick={() => setVisibleSidebar(false)} />
        </div>
      </Sidebar>
    </div>
  );
}
