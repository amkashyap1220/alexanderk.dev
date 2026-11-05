// Who I am, for search engines (schema.org structured data). The homepage
// and the About page describe me with this, and research posts name me as
// their author by its @id.
export const site = "https://alexanderk.dev";

export const person = {
  "@type": "Person",
  "@id": `${site}/#person`,
  name: "Alexander Kashyap",
  url: `${site}/`,
  image: `${site}/img/linkedin-photo.jpg`,
  email: "mailto:alexander.kashyap@gmail.com",
  jobTitle: "Application Developer",
  worksFor: { "@type": "Organization", name: "K-Rise Systems" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "Northern Illinois University" },
  homeLocation: { "@type": "Place", name: "Chicago, Illinois" },
  sameAs: ["https://www.linkedin.com/in/alexander-kashyap/", "https://github.com/amkashyap1220"],
};
