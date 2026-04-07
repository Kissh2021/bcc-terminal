// Empêche l'ouverture d'une console Windows en release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose, Engine as _};
use hex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ── Token readonly embarqué à la compilation ───────────────────────────────
// Défini via .cargo/config.toml en local, ou env var GITHUB_READONLY_TOKEN en CI.
// N'est jamais accessible depuis le bundle JS.
const GITHUB_READONLY_TOKEN: &str = env!("GITHUB_READONLY_TOKEN");

const REPO_OWNER: &str = "kissh2021";
const REPO_NAME: &str = "bcc-docs";

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GithubUser {
    id: String,
    username: String,
    #[serde(rename = "passwordHash")]
    password_hash: String,
    group: String,
}

#[derive(Debug, Serialize, Clone)]
struct UserInfo {
    id: String,
    username: String,
    group: String,
}

#[derive(Debug, Deserialize)]
struct GithubContentsResponse {
    content: String,
}

// ── Helpers ────────────────────────────────────────────────────────────────

async fn fetch_users_json() -> Result<Vec<GithubUser>, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/_users.json",
        REPO_OWNER, REPO_NAME
    );

    let client = Client::new();
    let res = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("Authorization", format!("Bearer {}", GITHUB_READONLY_TOKEN))
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", "bcc-terminal/1.0")
        .send()
        .await
        .map_err(|e| format!("ERREUR RÉSEAU : {}", e))?;

    if !res.status().is_success() {
        return Err(match res.status().as_u16() {
            401 => "TOKEN INVALIDE".to_string(),
            404 => "FICHIER _users.json INTROUVABLE".to_string(),
            s   => format!("ERREUR GITHUB : {}", s),
        });
    }

    let data: GithubContentsResponse = res
        .json()
        .await
        .map_err(|e| format!("ERREUR PARSE GITHUB : {}", e))?;

    // Le contenu GitHub est en base64 avec des sauts de ligne
    let cleaned = data.content.replace(['\n', '\r', ' '], "");
    let bytes = general_purpose::STANDARD
        .decode(&cleaned)
        .map_err(|e| format!("ERREUR BASE64 : {}", e))?;
    let json = String::from_utf8(bytes)
        .map_err(|e| format!("ERREUR UTF-8 : {}", e))?;

    serde_json::from_str(&json)
        .map_err(|e| format!("ERREUR FORMAT UTILISATEURS : {}", e))
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

// ── Commandes Tauri ────────────────────────────────────────────────────────

/// Authentifie un utilisateur.
/// Retourne UserInfo si succès, ou une string d'erreur (affichée dans l'UI).
#[tauri::command]
async fn login(username: String, password: String) -> Result<UserInfo, String> {
    let users = fetch_users_json().await?;

    let user = users
        .iter()
        .find(|u| u.username.to_lowercase() == username.to_lowercase())
        .ok_or_else(|| "UTILISATEUR INCONNU".to_string())?;

    if sha256_hex(&password) != user.password_hash {
        return Err("MOT DE PASSE INCORRECT".to_string());
    }

    Ok(UserInfo {
        id:       user.id.clone(),
        username: user.username.clone(),
        group:    user.group.clone(),
    })
}

/// Vérifie qu'un utilisateur (par son ID) existe toujours dans _users.json.
/// Utilisé au démarrage pour restaurer la session sans re-saisir le mot de passe.
#[tauri::command]
async fn restore_session(user_id: String) -> Result<UserInfo, String> {
    let users = fetch_users_json().await?;

    let user = users
        .iter()
        .find(|u| u.id == user_id)
        .ok_or_else(|| "SESSION EXPIRÉE — UTILISATEUR SUPPRIMÉ".to_string())?;

    Ok(UserInfo {
        id:       user.id.clone(),
        username: user.username.clone(),
        group:    user.group.clone(),
    })
}

/// Retourne le SHA-256 hex d'un mot de passe.
/// Utilisé par l'UI admin pour créer ou réinitialiser des comptes
/// sans exposer la logique de hash dans le bundle JS.
#[tauri::command]
fn hash_password(password: String) -> String {
    sha256_hex(&password)
}

/// Redémarre l'application (utilisé après installation d'une mise à jour).
#[tauri::command]
fn relaunch(app: tauri::AppHandle) {
    app.restart();
}

// ── Main ───────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![login, restore_session, hash_password, relaunch])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de BCC Terminal");
}
