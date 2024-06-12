import { MetadataRoute } from "next";
import { allProjects } from "contentlayer/generated";

export default function sitemap(): MetadataRoute.Sitemap {
  const filteredProjects = allProjects.filter((p) => p.published);
  return filteredProjects.map((project) => ({
    url: "https://ronaldburns.dev/projects/" + project.slug,
    lastModified: project.lastModified ? new Date(project.lastModified).toISOString() : undefined,
    changeFrequency: "monthly",
    priority: 1,
  }));
}
