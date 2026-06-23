export default async function handler(req, res) {
  const { tab } = req.query;

  const allowedTabs = [
    "Selector_Referencias",
    "Componentes_Criticos",
    "Explosion_Necesidades"
  ];

  if (!allowedTabs.includes(tab)) {
    return res.status(400).send("Tab no permitida");
  }

  const sheetId = "1gOYX20vbzV0_jltJgw-7l9bc8iQDvglDdDhfOoS9SfQ";

  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .send(`Error leyendo Google Sheets: ${response.status}`);
    }

    const csv = await response.text();

    if (csv.includes("<html") || csv.includes("<!DOCTYPE")) {
      return res.status(500).send("Google devolvió HTML, no CSV.");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).send(error.message);
  }
}
