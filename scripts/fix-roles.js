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

async function fixRoles() {
  console.log("🔄 Correction des rôles manquants...\n");

  try {
    // Insérer les rôles dans molam_roles_catalog
    const roles = [
      { name: 'client', display: 'Client', desc: 'Utilisateur client standard' },
      { name: 'merchant', display: 'Marchand', desc: 'Marchand / Vendeur' },
      { name: 'agent', display: 'Agent', desc: 'Agent de service' },
    ];

    // D'abord, découvrons les colonnes de la table
    const tableInfo = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'molam_roles_catalog'
      ORDER BY ordinal_position
    `);

    console.log("📋 Colonnes de molam_roles_catalog:");
    tableInfo.rows.forEach(col => console.log(`   - ${col.column_name} (${col.data_type})`));
    console.log("");

    // Insérer les rôles avec role_name, module, et description
    for (const role of roles) {
      try {
        await pool.query(`
          INSERT INTO molam_roles_catalog (role_name, module, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (role_name) DO NOTHING
        `, [role.name, 'id', role.desc]);

        console.log(`✅ Rôle '${role.name}' ajouté/vérifié`);
      } catch (err) {
        console.log(`⚠️  Erreur pour le rôle '${role.name}':`, err.message);
      }
    }

    // Vérifier les rôles existants
    const result = await pool.query(`
      SELECT * FROM molam_roles_catalog ORDER BY role_name LIMIT 10
    `);

    console.log("\n📋 Rôles disponibles:");
    result.rows.forEach(r => console.log(`   - ${r.role_name} (${r.display_name})`));

    console.log("\n✅ Terminé ! Vous pouvez maintenant créer des utilisateurs.");

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await pool.end();
  }
}

fixRoles();
