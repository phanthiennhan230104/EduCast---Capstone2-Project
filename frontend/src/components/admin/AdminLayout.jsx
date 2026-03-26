import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import "../../style/admin/admin-layout.css";

export default function AdminLayout({ title, subtitle, children }) {
  return (
    <div className="admin-layout">
      <AdminSidebar />

      <section className="admin-layout-content">
        <AdminHeader title={title} subtitle={subtitle} />

        <main className="admin-layout-main">
          
          {children}
        </main>
      </section>
    </div>
  );
}