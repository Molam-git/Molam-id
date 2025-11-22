import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "molam",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

async function addBasicRoles() {
  console.log("🔄 Ajout des rôles de base...\n");

  const basicRoles = [
    {
      role_name: "client",
      display_name: "Client",
      module: "*",
      description: "Utilisateur client standard",
      is_system_role: true,
    },
    {
      role_name: "merchant",
      display_name: "Marchand",
      module: "*",
      description: "Marchand / Vendeur",
      is_system_role: true,
    },
    {
      role_name: "agent",
      display_name: "Agent",
      module: "*",
      description: "Agent de service",
      is_system_role: true,
    },
  ];

  try {
    for (const role of basicRoles) {
      // Vérifier si le rôle existe déjà
      const existingRole = await pool.query(
        "SELECT role_name FROM molam_roles WHERE role_name = $1",
        [role.role_name]
      );

      if (existingRole.rows.length > 0) {
        console.log(`ℹ️  Le rôle '${role.role_name}' existe déjà`);
      } else {
        await pool.query(
          `INSERT INTO molam_roles (role_name, display_name, module, description, is_system_role, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [role.role_name, role.display_name, role.module, role.description, role.is_system_role]
        );
        console.log(`✅ Rôle '${role.role_name}' ajouté avec succès`);
      }
    }

    console.log("\n✅ Tous les rôles de base ont été ajoutés !");

    // Afficher tous les rôles
    const allRoles = await pool.query(
      "SELECT role_name, display_name, module, is_system_role FROM molam_roles ORDER BY role_name"
    );

    console.log("\n📋 Rôles disponibles dans la base de données :");
    console.table(allRoles.rows);

  } catch (error) {
    console.error("❌ Erreur lors de l'ajout des rôles :", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Exécuter
addBasicRoles().catch((err) => {
  console.error("Erreur:", err);
  process.exit(1);
});
