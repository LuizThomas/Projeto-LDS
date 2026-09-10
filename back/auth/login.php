<?php
session_start();

require_once '../conexao.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $senha = $_POST['password'] ?? $_POST['senha'] ?? '';

    if (!$email || !$senha) {
        header("Location: ../../front/pages(html)/auth/login.html?erro=preencha_campos");
        exit;
    }

    try {
        $sql = "SELECT id_usuario, nome, email, senha_hash, perfil FROM usuario WHERE email = :email";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':email' => $email]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($usuario && password_verify($senha, $usuario['senha_hash'])) {
            $_SESSION['usuario_id'] = $usuario['id_usuario'];
            $_SESSION['usuario_nome'] = $usuario['nome'];
            $_SESSION['usuario_email'] = $usuario['email'];
            $_SESSION['usuario_perfil'] = $usuario['perfil'];

            header("Location: ../../front/pages(html)/participante/dashboard.html");
            exit;
        }

        header("Location: ../../front/pages(html)/auth/login.html?erro=credenciais_invalidas");
        exit;

    } catch (PDOException $e) {
        error_log($e->getMessage());
        die("Erro ao processar o login. Tente novamente mais tarde.");
    }
}
?>