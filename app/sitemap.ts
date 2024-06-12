import { MetadataRoute } from "next";
import { allProjects } from "contentlayer/generated";

export default function sitemap(): MetadataRoute.Sitemap {
  const filteredProjects = allProjects.filter((p) => p.published);
  const projectsSitemap: MetadataRoute.Sitemap = filteredProjects.map(
    (project) => ({
      url: "https://ronaldburns.dev/projects/" + project.slug,
      lastModified: project.lastModified
        ? new Date(project.lastModified).toISOString()
        : undefined,
      changeFrequency: "monthly",
      priority: 1,
    })
  );

  const pagesSitemap: MetadataRoute.Sitemap = [
    {
      url: "https://ronaldburns.dev/",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://ronaldburns.dev/contact",
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  return [...pagesSitemap, ...projectsSitemap];
}
