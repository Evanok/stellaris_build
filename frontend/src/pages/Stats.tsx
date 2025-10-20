import { useEffect, useState } from 'react';
import { Container, Card, Row, Col, Alert, Spinner, ListGroup } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface TopItem {
  name: string;
  count: number;
  percentage: string;
}

interface Contributor {
  username: string;
  avatar: string | null;
  buildCount: number;
}

interface StatsData {
  totalBuilds: number;
  topCivics: TopItem[];
  topEthics: TopItem[];
  topOrigins: TopItem[];
  topAuthorities: TopItem[];
  topAscensionPerks: TopItem[];
  topTraditions: TopItem[];
  topContributors: Contributor[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658'];

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch statistics');
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
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="light" />
        <p className="text-white mt-3">Loading community statistics...</p>
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

  const renderTopItemsChart = (data: TopItem[], title: string) => (
    <Card bg="secondary" text="white" className="mb-4">
      <Card.Body>
        <Card.Title>{title}</Card.Title>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis type="number" stroke="#fff" />
              <YAxis type="category" dataKey="name" stroke="#fff" width={150} />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} (${props.payload.percentage}%)`,
                  'Count'
                ]}
              />
              <Bar dataKey="count" name="Usage">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white">No data available yet.</p>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <Container className="py-5">
      <h1 className="text-white mb-4">Community Statistics</h1>

      {/* Overview */}
      <Card bg="secondary" text="white" className="mb-4">
        <Card.Body>
          <Card.Title>Total Builds Shared</Card.Title>
          <h2 className="text-center">{stats.totalBuilds}</h2>
        </Card.Body>
      </Card>

      {/* Top Picks - Grid Layout */}
      <Row>
        <Col lg={6}>
          {renderTopItemsChart(stats.topCivics, 'Top 3 Most Popular Civics')}
        </Col>
        <Col lg={6}>
          {renderTopItemsChart(stats.topEthics, 'Top 3 Most Popular Ethics')}
        </Col>
      </Row>

      <Row>
        <Col lg={6}>
          {renderTopItemsChart(stats.topOrigins, 'Top 3 Most Popular Origins')}
        </Col>
        <Col lg={6}>
          {renderTopItemsChart(stats.topAuthorities, 'Top 3 Most Popular Authorities')}
        </Col>
      </Row>

      <Row>
        <Col lg={6}>
          {renderTopItemsChart(stats.topAscensionPerks, 'Top 3 Most Popular Ascension Perks')}
        </Col>
        <Col lg={6}>
          {renderTopItemsChart(stats.topTraditions, 'Top 3 Most Popular Traditions')}
        </Col>
      </Row>

      {/* Top Contributors */}
      <Card bg="secondary" text="white" className="mb-4">
        <Card.Body>
          <Card.Title>Top 5 Contributors</Card.Title>
          {stats.topContributors.length > 0 ? (
            <ListGroup variant="flush">
              {stats.topContributors.map((contributor, index) => (
                <ListGroup.Item
                  key={index}
                  className="bg-dark text-white d-flex align-items-center justify-content-between"
                  style={{ border: '1px solid #444' }}
                >
                  <div className="d-flex align-items-center">
                    <div className="me-3 text-secondary fw-bold" style={{ fontSize: '1.5rem' }}>
                      #{index + 1}
                    </div>
                    {contributor.avatar && (
                      <img
                        src={contributor.avatar}
                        alt={contributor.username}
                        className="rounded-circle me-3"
                        width="40"
                        height="40"
                      />
                    )}
                    <span className="fw-bold">{contributor.username}</span>
                  </div>
                  <span className="badge bg-primary rounded-pill">
                    {contributor.buildCount} builds
                  </span>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p className="text-white">No contributors yet.</p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
