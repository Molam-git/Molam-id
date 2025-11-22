/**
 * Routes d'administration - Index
 * Regroupe toutes les routes admin
 */

export {
  listUsersHandler,
  getUserStatsHandler,
  getUserByIdHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  suspendUserHandler,
  activateUserHandler,
  getUserAuditHandler
} from "./users.js";

export {
  listRolesHandler,
  assignRoleToUserHandler,
  revokeRoleFromUserHandler,
  getUserRolesAdminHandler,
  createRoleHandler,
  deleteRoleHandler
} from "./roles.js";

export {
  uploadUserPhotoHandler,
  deleteUserPhotoHandler
} from "./upload.js";
