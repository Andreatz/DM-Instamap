import { NewProjectForm } from "@/components/projects/new-project-form";

export default function NewProjectPage() {
  return (
    <main className="asset-page">
      <header className="asset-hero">
        <div>
          <strong>DM-Instamap</strong>
          <h1>New Project</h1>
          <p>Create a local project backed by an editable MapDocument.</p>
        </div>
      </header>

      <NewProjectForm />
    </main>
  );
}
