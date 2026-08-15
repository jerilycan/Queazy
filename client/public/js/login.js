document.addEventListener('DOMContentLoaded', () => {
  console.log("login.js DOMContentLoaded");

  const loginIdentifierInput = document.getElementById('loginIdentifier')
  const loginPasswordInput = document.getElementById('loginPassword')
  const signInBtn = document.getElementById('signIn')
  const loginError = document.getElementById('loginError')
  const loginReason = document.getElementById('loginReason')
  const loginCard = document.getElementById('loginCard')

  const signupEmailInput = document.getElementById('signupEmail')
  const signupPseudoInput = document.getElementById('signupPseudo')
  const signupPasswordInput = document.getElementById('signupPassword')
  const signUpBtn = document.getElementById('signUp')
  const signupError = document.getElementById('signupError')
  const signupCard = document.getElementById('signupCard')

  const guestPlayBtn = document.getElementById('guestPlay')
  const successCard = document.getElementById('successCard')
  const backToLoginBtn = document.getElementById('backToLogin')
  const resendEmailBtn = document.getElementById('resendEmail')
  const resendMessage = document.getElementById('resendMessage')
  const showSignupLink = document.getElementById('showSignup')
  const showLoginLink = document.getElementById('showLogin')

  console.log("Elements found:", {
    loginIdentifierInput: !!loginIdentifierInput,
    signInBtn: !!signInBtn,
    signUpBtn: !!signUpBtn,
    resendEmailBtn: !!resendEmailBtn
  });

  // Initialisation Supabase (chargé via supabase-config.js)
  const sb = window.supabaseClient

  if (!sb) {
    console.error("ERREUR : supabaseClient n'est pas défini !");
  }

  // Vérification si déjà connecté
  const checkExistingSession = async () => {
    if (!sb) return;
    try {
      console.log("Vérification de la session existante...");
      const { data: { session }, error } = await sb.auth.getSession()
      if (error) throw error;
      if (session) {
        console.log("Session trouvée, redirection...");
        window.location.href = '/'
      }
    } catch (err) {
      console.error("Erreur lors de la vérification de session:", err);
    }
  }

  checkExistingSession()

  // Message contextuel quand on est redirigé ici depuis une action nécessitant une connexion
  const reasonMessages = {
    create: 'Connecte-toi pour créer un quiz.'
  }
  const reason = new URLSearchParams(window.location.search).get('reason')
  if (reason && reasonMessages[reason] && loginReason) {
    loginReason.textContent = reasonMessages[reason]
    loginReason.classList.remove('d-none')
  }

  // --- Bascule entre la carte de connexion et la carte de création de compte ---
  const showLoginCard = () => {
    signupCard.classList.add('d-none')
    successCard.classList.add('d-none')
    loginCard.classList.remove('d-none')
  }
  const showSignupCard = () => {
    loginCard.classList.add('d-none')
    successCard.classList.add('d-none')
    signupCard.classList.remove('d-none')
  }
  if (showSignupLink) showSignupLink.onclick = (e) => { e.preventDefault(); showSignupCard() }
  if (showLoginLink) showLoginLink.onclick = (e) => { e.preventDefault(); showLoginCard() }

  const showLoginError = (message) => {
    if (loginError) {
      loginError.textContent = message
      loginError.classList.remove('d-none')
    } else if (window.QzUI) {
      window.QzUI.toast(message, 'error')
    } else {
      alert(message)
    }
  }
  const hideLoginError = () => { if (loginError) loginError.classList.add('d-none') }

  const showSignupError = (message) => {
    if (signupError) {
      signupError.textContent = message
      signupError.classList.remove('d-none')
    } else if (window.QzUI) {
      window.QzUI.toast(message, 'error')
    } else {
      alert(message)
    }
  }
  const hideSignupError = () => { if (signupError) signupError.classList.add('d-none') }

  if (signInBtn) {
    signInBtn.onclick = async (e) => {
      e.preventDefault();
      console.log("Clic sur Se connecter");
      hideLoginError()
      const identifier = loginIdentifierInput.value.trim()
      const password = loginPasswordInput.value

      if (!identifier || !password) {
        showLoginError('Remplis tous les champs.')
        return
      }

      try {
        // Supabase n'authentifie que par email : si l'utilisateur a tapé un
        // pseudo, on le résout d'abord côté base (voir resolve_login_email
        // dans supabase/schema.sql).
        let email = identifier
        if (!identifier.includes('@')) {
          const { data: resolved, error: resolveError } = await sb.rpc('resolve_login_email', { identifier })
          if (resolveError || !resolved) {
            // Message générique : ne pas révéler si c'est le pseudo ou le
            // mot de passe qui est incorrect.
            showLoginError('Identifiants incorrects.')
            return
          }
          email = resolved
        }

        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          showLoginError(error.message)
        } else {
          localStorage.removeItem('queazy_guest')
          window.location.href = '/'
        }
      } catch (err) {
        console.error("Erreur lors de la connexion:", err);
        showLoginError("Une erreur est survenue lors de la connexion.")
      }
    }
  }

  if (signUpBtn) {
    signUpBtn.onclick = async (e) => {
      e.preventDefault();
      console.log("Bouton Créer un compte cliqué");
      hideSignupError()

      const email = signupEmailInput.value.trim()
      const password = signupPasswordInput.value
      const pseudo = signupPseudoInput.value ? signupPseudoInput.value.trim() : ''

      if (!email || !password) {
        showSignupError('Remplis au moins l\'email et le mot de passe.')
        return
      }

      if (password.length < 6) {
        showSignupError('Le mot de passe doit faire au moins 6 caractères.')
        return
      }

      const signupOptions = {
        email,
        password,
      }

      if (pseudo) {
        signupOptions.options = {
          data: {
            full_name: pseudo
          }
        }
      }

      console.log("Tentative d'inscription pour:", email);
      try {
        const { data, error } = await sb.auth.signUp(signupOptions)

        if (error) {
          console.error("Erreur Supabase signUp :", error);
          showSignupError(error.message)
        } else {
          console.log("Réponse Supabase signUp :", data);
          localStorage.removeItem('queazy_guest')

          if (pseudo) {
            localStorage.setItem('queazy_profile_name', pseudo)
          }

          if (data.user && data.user.identities && data.user.identities.length === 0) {
            showSignupError("Cet email est déjà utilisé.")
            return
          }

          if (data.user) {
            if (!data.session) {
              console.log("Inscription réussie, attente confirmation email");
              signupCard.classList.add('d-none')
              successCard.classList.remove('d-none')
            } else {
              console.log("Inscription réussie, session créée");
              window.location.href = '/'
            }
          } else {
            showSignupError("Une erreur inconnue est survenue lors de l'inscription.")
          }
        }
      } catch (err) {
        console.error("Exception lors de l'inscription:", err);
        showSignupError("Une erreur technique est survenue.")
      }
    }
  }

  const signInGoogleBtn = document.getElementById('signInGoogle')
  if (signInGoogleBtn) {
    signInGoogleBtn.onclick = async (e) => {
      e.preventDefault();
      console.log("Clic sur Continuer avec Google");
      hideLoginError()
      localStorage.removeItem('queazy_guest')
      try {
        const { error } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/' }
        })
        if (error) showLoginError(error.message)
      } catch (err) {
        console.error("Erreur lors de la connexion Google:", err);
        showLoginError("Une erreur est survenue lors de la connexion avec Google.")
      }
    }
  }

  if (guestPlayBtn) {
    guestPlayBtn.onclick = (e) => {
      e.preventDefault();
      console.log("Clic sur Jouer en tant qu'invité");
      localStorage.setItem('queazy_guest', 'true')
      window.location.href = '/'
    }
  }

  if (backToLoginBtn) {
    backToLoginBtn.onclick = (e) => {
      e.preventDefault();
      showLoginCard()
    }
  }

  if (resendEmailBtn) {
    resendEmailBtn.onclick = async (e) => {
      e.preventDefault();
      const email = signupEmailInput.value;
      if (!email) {
        if (window.QzUI) window.QzUI.toast("Entre ton email d'abord.", 'error')
        else alert("Entre ton email d'abord.");
        return;
      }

      console.log("Renvoi de l'email à:", email);
      resendEmailBtn.disabled = true;
      resendEmailBtn.textContent = "Envoi en cours...";

      const { error } = await sb.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        console.error("Erreur renvoi email:", error);
        if (window.QzUI) window.QzUI.toast("Erreur : " + error.message, 'error')
        else alert("Erreur: " + error.message);
        resendEmailBtn.disabled = false;
        resendEmailBtn.textContent = "Je n'ai rien reçu, renvoyer l'email";
      } else {
        resendMessage.textContent = "Email renvoyé avec succès !";
        resendMessage.classList.remove('d-none');
        setTimeout(() => {
          resendEmailBtn.disabled = false;
          resendEmailBtn.textContent = "Je n'ai rien reçu, renvoyer l'email";
        }, 5000);
      }
    };
  }
});
