document.addEventListener('DOMContentLoaded', () => {
  console.log("login.js DOMContentLoaded");

  const emailInput = document.getElementById('email')
  const pseudoInput = document.getElementById('pseudo')
  const passwordInput = document.getElementById('password')
  const signInBtn = document.getElementById('signIn')
  const signUpBtn = document.getElementById('signUp')
  const guestPlayBtn = document.getElementById('guestPlay')
  const loginError = document.getElementById('loginError')
  const loginReason = document.getElementById('loginReason')
  const loginCard = document.getElementById('loginCard')
  const successCard = document.getElementById('successCard')
  const backToLoginBtn = document.getElementById('backToLogin')
  const resendEmailBtn = document.getElementById('resendEmail')
  const resendMessage = document.getElementById('resendMessage')

  console.log("Elements found:", { 
    emailInput: !!emailInput, 
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

  const showError = (message) => {
    if (loginError) {
      loginError.textContent = message
      loginError.classList.remove('d-none')
    } else {
      alert(message)
    }
  }

  const hideError = () => {
    if (loginError) loginError.classList.add('d-none')
  }

  if (signInBtn) {
    signInBtn.onclick = async (e) => {
      e.preventDefault();
      console.log("Clic sur Se connecter");
      hideError()
      const email = emailInput.value
      const password = passwordInput.value

      if (!email || !password) {
        showError('Veuillez remplir tous les champs.')
        return
      }

      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          showError(error.message)
        } else {
          localStorage.removeItem('queazy_guest')
          window.location.href = '/'
        }
      } catch (err) {
        console.error("Erreur lors de la connexion:", err);
        showError("Une erreur est survenue lors de la connexion.")
      }
    }
  }

  if (signUpBtn) {
    signUpBtn.onclick = async (e) => {
      e.preventDefault();
      console.log("Bouton Créer un compte cliqué");
      hideError()
      
      const email = emailInput.value
      const password = passwordInput.value
      const pseudo = pseudoInput.value ? pseudoInput.value.trim() : ''

      if (!email || !password) {
        showError('Veuillez remplir au moins l\'email et le mot de passe.')
        return
      }

      if (password.length < 6) {
        showError('Le mot de passe doit faire au moins 6 caractères.')
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
          showError(error.message)
        } else {
          console.log("Réponse Supabase signUp :", data);
          localStorage.removeItem('queazy_guest')
          
          if (pseudo) {
            localStorage.setItem('queazy_profile_name', pseudo)
          }

          if (data.user && data.user.identities && data.user.identities.length === 0) {
            showError("Cet email est déjà utilisé.")
            return
          }

          if (data.user) {
            if (!data.session) {
              console.log("Inscription réussie, attente confirmation email");
              loginCard.classList.add('d-none')
              successCard.classList.remove('d-none')
            } else {
              console.log("Inscription réussie, session créée");
              window.location.href = '/'
            }
          } else {
            showError("Une erreur inconnue est survenue lors de l'inscription.")
          }
        }
      } catch (err) {
        console.error("Exception lors de l'inscription:", err);
        showError("Une erreur technique est survenue.")
      }
    }
  }

  const signInGoogleBtn = document.getElementById('signInGoogle')
  if (signInGoogleBtn) {
    signInGoogleBtn.onclick = async (e) => {
      e.preventDefault();
      console.log("Clic sur Continuer avec Google");
      hideError()
      localStorage.removeItem('queazy_guest')
      try {
        const { error } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/' }
        })
        if (error) showError(error.message)
      } catch (err) {
        console.error("Erreur lors de la connexion Google:", err);
        showError("Une erreur est survenue lors de la connexion avec Google.")
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
      successCard.classList.add('d-none')
      loginCard.classList.remove('d-none')
    }
  }

  if (resendEmailBtn) {
    resendEmailBtn.onclick = async (e) => {
      e.preventDefault();
      const email = emailInput.value;
      if (!email) {
        alert("Veuillez entrer votre email d'abord.");
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
        alert("Erreur: " + error.message);
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
