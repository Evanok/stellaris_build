import React from 'react';

const Login: React.FC = () => {
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card bg-dark text-white border-secondary">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Sign In to Stellaris Build</h2>
              <p className="text-center text-muted mb-4">
                Sign in to create and share your own Stellaris empire builds
              </p>

              <div className="d-grid gap-3">
                {/* Steam Login Button */}
                <a
                  href="/auth/steam"
                  className="btn btn-lg btn-dark border-light d-flex align-items-center justify-content-center"
                  style={{ backgroundColor: '#171a21' }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="currentColor"
                    className="me-3"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9l5.17 2.14c.38-.31.87-.5 1.39-.5.08 0 .15.01.23.02l2.31-3.34c.03 0 .06-.01.09-.01 2.3 0 4.17 1.87 4.17 4.17 0 2.31-1.87 4.17-4.17 4.17-.08 0-.15-.01-.23-.02l-3.32 2.36c0 .03.01.06.01.09 0 1.2-.98 2.17-2.17 2.17-1.01 0-1.85-.69-2.09-1.62l-3.69-1.53c.66 3.31 3.56 5.8 7.04 5.8z" />
                  </svg>
                  Sign in with Steam
                </a>

                {/* Google Login Button */}
                <a
                  href="/auth/google"
                  className="btn btn-lg btn-light d-flex align-items-center justify-content-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="me-3"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </a>
              </div>

              <div className="text-center mt-4">
                <p className="text-muted small">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-3">
            <a href="/" className="text-decoration-none text-light">
              &larr; Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
