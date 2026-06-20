export default {
  logo: <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>⬡ LumensBlock</span>,
  project: { link: "https://github.com/metro-logic/lumens-block" },
  docsRepositoryBase: "https://github.com/metro-logic/lumens-block/edit/main/docs",
  useNextSeoProps() {
    return { titleTemplate: "%s – LumensBlock Docs" };
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="LumensBlock documentation — build Stellar smart contracts visually." />
    </>
  ),
  footer: {
    text: <span>MIT {new Date().getFullYear()} © Metro Logic</span>,
  },
};
