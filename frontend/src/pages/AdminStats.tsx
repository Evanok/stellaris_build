import { useEffect, useState } from 'react';
import { Container, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../AuthContext';
import { Link, useNavigate } from 'react-router-dom';

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
  comments: {
    visible: number;
    deleted: number;
    thisMonth: number;
    withQuote: number;
    commenters: number;
    buildsCommented: number;
    reports: { total: number; openComments: number };
  };
  commentsPerWeek: { week: string; count: number }[];
  topCommentedBuilds: { id: number; name: string; count: number; lastCommentAt: string }[];
  visitorsPerDay: { day: string; loggedIn: number; anonymous: number }[];
  activeUsers: { last7Days: number; last30Days: number };
}

// Last 30 days, including days without any recorded visit
function fillVisitorDays(rows: { day: string; loggedIn: number; anonymous: number }[]) {
  const byDay = new Map(rows.map(r => [r.day, r]));
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const day = d.toISOString().slice(0, 10);
    const row = byDay.get(day);
    days.push({ day: day.slice(5), loggedIn: row?.loggedIn ?? 0, anonymous: row?.anonymous ?? 0 });
  }
  return days;
}

const average = (values: number[]) =>
  values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '-';

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

      {/* Visitors (backend/visitors.js) */}
      {(() => {
        const days = fillVisitorDays(stats.visitorsPerDay);
        const todayRow = days[days.length - 1];
        const last7 = days.slice(-7);
        return (
          <>
            <h4 className="text-white mb-3">Visitors</h4>
            <Row className="mb-3">
              <Col md={3}>
                <Card bg="secondary" text="white" className="mb-3">
                  <Card.Body>
                    <Card.Title>Today (UTC)</Card.Title>
                    <h2>{todayRow.loggedIn + todayRow.anonymous}</h2>
                    <small>{todayRow.loggedIn} logged in / {todayRow.anonymous} anonymous</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card bg="secondary" text="white" className="mb-3">
                  <Card.Body>
                    <Card.Title>Daily Average (7 Days)</Card.Title>
                    <h2>{average(last7.map(d => d.loggedIn + d.anonymous))}</h2>
                    <small>
                      {average(last7.map(d => d.loggedIn))} logged in / {average(last7.map(d => d.anonymous))} anonymous
                    </small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card bg="secondary" text="white" className="mb-3">
                  <Card.Body>
                    <Card.Title>Active Accounts (7 Days)</Card.Title>
                    <h2>{stats.activeUsers.last7Days}</h2>
                    <small>distinct logged-in users who visited</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card bg="secondary" text="white" className="mb-3">
                  <Card.Body>
                    <Card.Title>Active Accounts (30 Days)</Card.Title>
                    <h2>{stats.activeUsers.last30Days}</h2>
                    <small>{percent(stats.activeUsers.last30Days, stats.totalUsers)} of all accounts</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <Card bg="secondary" text="white" className="mb-4">
              <Card.Body>
                <Card.Title>Unique Visitors per Day (Last 30 Days)</Card.Title>
                <small className="d-block mb-2">
                  Counted by the site itself, not GA: one visitor per browser and day, only once it looks
                  human (interaction or 5s on screen). Admins are not counted. A visitor who logs in during
                  the day counts as logged in.
                </small>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="day" stroke="#fff" />
                    <YAxis stroke="#fff" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="loggedIn" stackId="visitors" fill="#82ca9d" name="Logged in" />
                    <Bar dataKey="anonymous" stackId="visitors" fill="#8884d8" name="Anonymous" />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          </>
        );
      })()}

      {/* Build comments */}
      <h4 className="text-white mb-3">Comments</h4>
      <Row className="mb-3">
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Comments</Card.Title>
              <h2>{stats.comments.visible}</h2>
              <small>{stats.comments.thisMonth} this month, {stats.comments.deleted} deleted</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Commenters</Card.Title>
              <h2>{stats.comments.commenters}</h2>
              <small>{percent(stats.comments.commenters, stats.totalUsers)} of all accounts</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Builds Commented</Card.Title>
              <h2>{stats.comments.buildsCommented}</h2>
              <small>{percent(stats.comments.withQuote, stats.comments.visible)} of comments quote another</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card bg="secondary" text="white" className="mb-3">
            <Card.Body>
              <Card.Title>Reports</Card.Title>
              <h2>{stats.comments.reports.total}</h2>
              <small>
                {stats.comments.reports.openComments > 0
                  ? <Link to="/admin/pending" className="text-white">{stats.comments.reports.openComments} comment(s) to review</Link>
                  : 'nothing to review'}
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row className="mb-4">
        <Col lg={8}>
          <Card bg="secondary" text="white" className="mb-3 h-100">
            <Card.Body>
              <Card.Title>Comments per Week (Last 12 Weeks)</Card.Title>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.commentsPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="week" stroke="#fff" />
                  <YAxis stroke="#fff" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#ff8042" name="Comments" />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card bg="secondary" text="white" className="mb-3 h-100">
            <Card.Body>
              <Card.Title>Most Commented Builds</Card.Title>
              {stats.topCommentedBuilds.length === 0 ? (
                <small>No comments yet.</small>
              ) : (
                <ol className="mb-0 ps-3">
                  {stats.topCommentedBuilds.map(b => (
                    <li key={b.id} className="mb-1">
                      <Link to={`/build/${b.id}#comments`} className="text-white">{b.name}</Link>{' '}
                      <small className="text-white-50">({b.count})</small>
                    </li>
                  ))}
                </ol>
              )}
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
