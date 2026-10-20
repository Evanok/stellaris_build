import { useEffect, useState } from 'react';
import { Container, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

interface AdminStatsData {
  totalUsers: number;
  newUsersThisMonth: number;
  totalBuilds: number;
  deletedBuilds: number;
  buildsPerWeek: { week: string; count: number }[];
  signupsPerWeek: { week: string; count: number }[];
  guestBuilds: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    withEmail: number;
    claimed: number;
  };
  guestSubmissionsPerWeek: { week: string; count: number }[];
}

// Builds and guest submissions on the same weeks (a week can be missing from either list)
function mergeWeeklyBuilds(builds: { week: string; count: number }[], guests: { week: string; count: number }[]) {
  const weeks = Array.from(new Set([...builds, ...guests].map(w => w.week))).sort();
  return weeks.map(week => ({
    week,
    builds: builds.find(w => w.week === week)?.count ?? 0,
    guests: guests.find(w => w.week === week)?.count ?? 0,
  }));
}

const percent = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '-');

export default function AdminStats() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Redirect if not logged in, or logged in but not an admin
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.is_admin !== 1) {
      navigate('/');
      return;
    }

    // Fetch admin stats
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats', {
          credentials: 'include'
        });

        if (response.status === 403) {
          setError('Access denied. Admin privileges required.');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch admin stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="light" />
        <p className="text-white mt-3">Loading admin statistics...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container className="py-5">
        <Alert variant="warning">No statistics available.</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h1 className="text-white mb-4">Admin Statistics</h1>

      {/* Overview Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Total Users</Card.Title>
              <h2>{stats.totalUsers}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>New Users (Month)</Card.Title>
              <h2>{stats.newUsersThisMonth}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Total Builds</Card.Title>
              <h2>{stats.totalBuilds}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Deleted Builds</Card.Title>
              <h2>{stats.deletedBuilds}</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Guest (no account) builds */}
      <h4 className="text-white mb-3">Builds Without an Account</h4>
      <Row className="mb-4">
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Guest Submissions</Card.Title>
              <h2>{stats.guestBuilds.total}</h2>
              <small>{stats.guestBuilds.pending} waiting for review</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Approved / Rejected</Card.Title>
              <h2>{stats.guestBuilds.approved} / {stats.guestBuilds.rejected}</h2>
              <small>{percent(stats.guestBuilds.approved, stats.guestBuilds.approved + stats.guestBuilds.rejected)} of reviewed ones approved</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Left an Email</Card.Title>
              <h2>{stats.guestBuilds.withEmail}</h2>
              <small>{percent(stats.guestBuilds.withEmail, stats.guestBuilds.total)} of guest submissions</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Claimed by an Account</Card.Title>
              <h2>{stats.guestBuilds.claimed}</h2>
              <small>{percent(stats.guestBuilds.claimed, stats.guestBuilds.total)} of guest submissions</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Builds per Week Chart */}
      <Card bg="secondary" text="white" className="mb-4">
        <Card.Body>
          <Card.Title>Builds Created per Week (Last 12 Weeks)</Card.Title>
          <small className="d-block mb-2">
            Published builds include approved guest builds, counted on their approval date.
            Guest submissions are counted on their submission date, whatever the review outcome.
          </small>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergeWeeklyBuilds(stats.buildsPerWeek, stats.guestSubmissionsPerWeek)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="week" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line type="monotone" dataKey="builds" stroke="#8884d8" name="Published builds" />
              <Line type="monotone" dataKey="guests" stroke="#ffc658" name="Guest submissions" />
            </LineChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>

      {/* Signups per Week Chart */}
      <Card bg="secondary" text="white" className="mb-4">
        <Card.Body>
          <Card.Title>User Signups per Week (Last 12 Weeks)</Card.Title>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.signupsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="week" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#82ca9d" name="Signups" />
            </LineChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </Container>
  );
}
