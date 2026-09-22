<?php
session_start();
require_once '../conexao.php';

if (!isset($_SESSION['usuario_id'])) {
    header("Location: ../../frontend/pages/auth/login.html");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id_evento = $_POST['id_evento'] ?? '';
    $id_usuario = $_SESSION['usuario_id'];

    if (!$id_evento) {
        die("Evento nao informado.");
    }

    $stmt = $pdo->prepare("SELECT status, inicio_inscricoes, fim_inscricoes, vagas_maximas FROM evento WHERE id_evento = :id");
    $stmt->execute([':id' => $id_evento]);
    $evento = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$evento || $evento['status'] !== 'PUBLICADO') {
        die("Evento indisponivel para inscricao.");
    }

    $agora = date('Y-m-d H:i:s');
    if ($agora < $evento['inicio_inscricoes'] || $agora > $evento['fim_inscricoes']) {
        die("Inscricoes fora do prazo permitido.");
    }

    $stmtVagas = $pdo->prepare("SELECT COUNT(*) as total FROM inscricao WHERE id_evento = :id AND status != 'CANCELADA'");
    $stmtVagas->execute([':id' => $id_evento]);
    $total = $stmtVagas->fetch(PDO::FETCH_ASSOC)['total'];

    if ($total >= $evento['vagas_maximas']) {
        header("Location: ../../frontend/pages/events/detail.php?id=" . $id_evento . "&erro=sem_vagas");
        exit;
    }

    try {
        $sql = "INSERT INTO inscricao (id_evento, id_usuario) VALUES (:id_evento, :id_usuario)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id_evento' => $id_evento,
            ':id_usuario' => $id_usuario
        ]);

        header("Location: ../../frontend/pages/events/detail.php?id=" . $id_evento . "&sucesso=1");
        exit;

    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            header("Location: ../../frontend/pages/events/detail.php?id=" . $id_evento . "&erro=ja_inscrito");
            exit;
        }
        die("Erro no banco: " . $e->getMessage());
    }
}
?>