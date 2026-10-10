import { useEffect, useState } from 'react';
import { Container, Card, Row, Col, Alert, Spinner, ListGroup } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

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
  versionDistribution: TopItem[];
  topCivics: TopItem[];
  topEthics: TopItem[];
  topOrigins: TopItem[];
  topAuthorities: TopItem[];
  topAscensionPerks: TopItem[];
  topTraditions: TopItem[];
  topTraits: TopItem[];
  topContributors: Contributor[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c'];

const VERSION_NAMES: Record<string, string> = {
  '4.5': '4.5 "Cygnus"',
  '4.4': '4.4 "Pegasus"',
  '4.3': '4.3 "Cetus"',
  '4.2': '4.2 "Corvus"',
  '4.1': '4.1 "Lyra"',
  '4.0': '4.0 "Phoenix"',
  '3.14': '3.14 "Circinus"',
  '3.13': '3.13 "Vela"',
};

// The pie always shows the most recent game versions individually and lumps everything else into
// "Older". Based on VERSION_NAMES (the game's release history), not on which versions have builds:
// a recent version with no build yet is simply absent from the pie rather than shown as 0%.
const RECENT_VERSION_COUNT = 4;
const RECENT_VERSIONS = Object.keys(VERSION_NAMES)
  .sort((a, b) => {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return bMajor - aMajor || bMinor - aMinor;
  })
  .slice(0, RECENT_VERSION_COUNT);

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

  const renderTopItemsChart = (data: TopItem[], title: string, height = 250) => (
    <Card bg="secondary" text="white" className="mb-4">
      <Card.Body>
        <Card.Title>{title}</Card.Title>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis type="number" stroke="#fff" />
              <YAxis type="category" dataKey="name" stroke="#fff" width={150} />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value, _name, props) => [
                  `${value} (${(props.payload as any)?.percentage}%)`,
                  'Count'
                ]}
              />
              <Bar dataKey="count" name="Usage">
                {data.map((_entry, index) => (
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
      <Row className="mb-4">
        <Col md={4}>
          <Card bg="secondary" text="white" className="h-100">
            <Card.Body className="text-center d-flex flex-column justify-content-center">
              <Card.Title>Total Builds Shared</Card.Title>
              <h2>{stats.totalBuilds}</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Card bg="secondary" text="white" className="h-100">
            <Card.Body>
              <Card.Title>Builds by Game Version</Card.Title>
              {(() => {
                const countByVersion = new Map(stats.versionDistribution.map(v => [v.name, v.count]));
                const recentSlices = RECENT_VERSIONS
                  .filter(v => (countByVersion.get(v) || 0) > 0)
                  .map(v => ({ name: VERSION_NAMES[v], value: countByVersion.get(v) as number }));
                const olderCount = stats.versionDistribution
                  .filter(v => !RECENT_VERSIONS.includes(v.name))
                  .reduce((sum, v) => sum + v.count, 0);
                const pieData = olderCount > 0 ? [...recentSlices, { name: 'Older', value: olderCount }] : recentSlices;
                return (
                  <ResponsiveContainer width="100%" height={240}>
                    {/* Labels sit outside the pie: the vertical margin keeps the top/bottom ones from being clipped */}
                    <PieChart margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }: any) => `${name} ${((percent as number) * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((_entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} builds`, '']} contentStyle={{ backgroundColor: '#333', border: '1px solid #555' }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </Card.Body>
          </Card>
        </Col>
      </Row>

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

      {renderTopItemsChart(stats.topTraits, 'Top 5 Most Popular Species Traits', 350)}

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
