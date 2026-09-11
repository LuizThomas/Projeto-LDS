<?php
session_start();
require_once '../conexao.php';

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['usuario_perfil'], ['Professor', 'Administrador'])) {
    header("Location: ../../front/pages(html)/auth/login.html");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id_evento = $_POST['id_evento'] ?? '';
    $titulo = trim($_POST['titulo'] ?? '');
    $descricao = trim($_POST['descricao'] ?? '');
    $data_inicio = $_POST['data_inicio'] ?? '';
    $data_fim = $_POST['data_fim'] ?? '';
    $inicio_inscricoes = $_POST['inicio_inscricoes'] ?? '';
    $fim_inscricoes = $_POST['fim_inscricoes'] ?? '';

    $stmt = $pdo->prepare("SELECT banner_url, id_organizador FROM evento WHERE id_evento = :id");
    $stmt->execute([':id' => $id_evento]);
    $evento = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$evento) {
        die("Evento nao encontrado.");
    }

    if ($_SESSION['usuario_perfil'] !== 'Administrador' && $evento['id_organizador'] != $_SESSION['usuario_id']) {
        die("Acesso negado.");
    }

    $banner_url = $evento['banner_url'];
    if (isset($_FILES['banner']) && $_FILES['banner']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['banner']['name'], PATHINFO_EXTENSION);
        $banner_url = uniqid() . '.' . $ext;
        move_uploaded_file($_FILES['banner']['tmp_name'], '../../uploads/' . $banner_url);
    }

    $sql = "UPDATE evento SET titulo = :titulo, descricao = :descricao, data_inicio = :data_inicio, data_fim = :data_fim, inicio_inscricoes = :inicio_inscricoes, fim_inscricoes = :fim_inscricoes, banner_url = :banner_url WHERE id_evento = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':titulo' => $titulo,
        ':descricao' => $descricao,
        ':data_inicio' => $data_inicio,
        ':data_fim' => $data_fim,
        ':inicio_inscricoes' => $inicio_inscricoes,
        ':fim_inscricoes' => $fim_inscricoes,
        ':banner_url' => $banner_url,
        ':id' => $id_evento
    ]);

    header("Location: ../../front/pages(html)/eventos/meus_eventos.php?editado=1");
    exit;
}
?>