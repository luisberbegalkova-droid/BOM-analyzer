export default async function handler(req, res) {
  const { tab } = req.query;

  const publishedCsvUrls = {
    Selector_Referencias:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTSKEQPigRheYbDewxHuCHlHixGeOa31Yd0VwJuR50jWKYVyGN4PTK_kcnrhoYAnlUr5sriN3orkpXy/pub?gid=1507911722&single=true&output=csv",

    Componentes_Criticos:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTSKEQPigRheYbDewxHuCHlHixGeOa31Yd0VwJuR50jWKYVyGN4PTK_kcnrhoYAnlUr5sriN3orkpXy/pub?gid=1812453680&single=true&output=csv",

    Explosion_Necesidades:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTSKEQPigRheYbDewxHuCHlHixGeOa31Yd0VwJuR50jWKYVyGN4PTK_kcnrhoYAnlUr5sriN3orkpXy/pub?gid=786204431&single=true&output=csv",

    Selector_Referencias_Inicial:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTSKEQPigRheYbDewxHuCHlHixGeOa31Yd0VwJuR50jWKYVyGN4PTK_kcnrhoYAnlUr5sriN3orkpXy/pub?gid=1683474306&single=true&output=csv",

    Explosion_Necesidades_Inicial:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTSKEQPigRheYbDewxHuCHlHixGeOa31Yd0VwJuR50jWKYVyGN4PTK_kcnrhoYAnlUr5sriN3orkpXy/pub?gid=150973808&single=true&output=csv"
  };

  const url = publishedCsvUrls[tab];

  if (!url) {
    return res.status(400).send("Tab no permitida");
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .send(`Error leyendo Google Sheets publicado: ${response.status}`);
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
