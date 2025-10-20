import { useEffect, useState } from 'react';
import { Container, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

interface AdminStatsData {
  totalUsers: number;
  newUsersThisMonth: number;
  totalBuilds: number;
  deletedBuilds: number;
  buildsPerWeek: { week: string; count: number }[];
  signupsPerWeek: { week: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
}

export default function AdminStats() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Redirect if not logged in
    if (!user) {
      navigate('/login');
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

      {/* Builds per Week Chart */}
      <Card bg="secondary" text="white" className="mb-4">
        <Card.Body>
          <Card.Title>Builds Created per Week (Last 12 Weeks)</Card.Title>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.buildsPerWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="week" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#8884d8" name="Builds" />
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

      {/* Top Referrers */}
      <Card bg="secondary" text="white" className="mb-4">
        <Card.Body>
          <Card.Title>Top Traffic Sources (Last 30 Days)</Card.Title>
          {stats.topReferrers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topReferrers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="referrer" stroke="#fff" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#fff" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="count" fill="#ffc658" name="Page Views" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white">No referrer data available yet.</p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
