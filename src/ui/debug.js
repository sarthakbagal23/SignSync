// Live feature inspector (design §7): every computed geometry value, refreshed
// every frame. This is the tuning tool that tells us what real numeric ranges
// look like — thresholds get set from this panel, not from guesses.
//
// Cells are built once and updated via textContent so a 30fps refresh never
// churns the DOM.

const fmt = (x) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(2));

function row(table, label, getValue) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.textContent = label;
  const td = document.createElement("td");
  tr.append(th, td);
  table.append(tr);
  return (frame, features) => {
    td.textContent = getValue(frame, features);
  };
}

function section(title) {
  const details = document.createElement("details");
  details.open = true;
  const summary = document.createElement("summary");
  summary.textContent = title;
  const table = document.createElement("table");
  details.append(summary, table);
  return { details, table };
}

export function createDebugPanel(container) {
  container.replaceChildren();

  const head = document.createElement("h2");
  head.textContent = "Feature inspector";
  container.append(head);

  const detection = section("Detection");
  const basis = section("Palm frame basis");
  const curls = section("Finger curl");
  const spreads = section("Adjacent spread");
  const crossing = section("Finger crossing (R)");
  const thumb = section("Thumb metrics");
  const orientation = section("Orientation (world)");
  container.append(
    detection.details,
    basis.details,
    curls.details,
    spreads.details,
    crossing.details,
    thumb.details,
    orientation.details,
  );

  const vec = (v) => (v ? `[${fmt(v[0])}, ${fmt(v[1])}, ${fmt(v[2])}]` : "—");

  const updaters = [
    row(detection.table, "handedness label", (_f, _x, meta) => meta?.label ?? "—"),
    row(detection.table, "scale (wrist→knuckle)", (f) => fmt(f?.scale)),
    row(basis.table, "u (palm up, world)", (f) => vec(f?.uWorld)),
    row(basis.table, "v (palm right)", (f) => vec(f?.v)),
    row(basis.table, "w (out of palm)", (f) => vec(f?.wWorld)),
    ...["index", "middle", "ring", "pinky"].map((name) =>
      row(curls.table, name, (_f, feat) => fmt(feat?.curl?.[name])),
    ),
    ...[
      ["indexMiddle", "index↔middle"],
      ["middleRing", "middle↔ring"],
      ["ringPinky", "ring↔pinky"],
    ].map(([key, label]) =>
      row(spreads.table, label, (_f, feat) =>
        feat ? `${(feat.spread[key] * 180 / Math.PI).toFixed(1)}°` : "—",
      ),
    ),
    row(crossing.table, "index lateral", (_f, feat) => fmt(feat?.crossing?.indexLateral)),
    row(crossing.table, "middle lateral", (_f, feat) => fmt(feat?.crossing?.middleLateral)),
    row(crossing.table, "crossed?", (_f, feat) => (feat ? (feat.crossing.isCrossed ? "yes" : "no") : "—")),
    ...["index", "middle", "ring", "pinky"].map((name) =>
      row(thumb.table, `tip→${name}`, (_f, feat) => fmt(feat?.thumb?.tipDist?.[name])),
    ),
    ...["index", "middle", "ring", "pinky"].map((name) =>
      row(thumb.table, `thumb→${name} PIP`, (_f, feat) => fmt(feat?.thumb?.pipDist?.[name])),
    ),
    ...["index", "middle", "ring", "pinky"].map((name) =>
      row(thumb.table, `thumb→${name} MCP`, (_f, feat) => fmt(feat?.thumb?.mcpDist?.[name])),
    ),
    row(thumb.table, "signed normal", (_f, feat) => fmt(feat?.thumb?.signedNormal)),
    row(thumb.table, "lateral (across MCPs)", (_f, feat) => fmt(feat?.thumb?.lateral)),
    row(orientation.table, "pointing (u)", (_f, feat) => vec(feat?.orientation?.pointing)),
    row(orientation.table, "palm facing (w)", (_f, feat) => vec(feat?.orientation?.palmFacing)),
  ];

  return {
    update(frame, features, meta) {
      for (const set of updaters) set(frame, features, meta);
    },
  };
}
