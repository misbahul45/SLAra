package entities

import "time"

type Traffic struct {
	ID              string    `bson:"_id"             json:"id"`
	FromHub         string    `bson:"fromHub"         json:"fromHub"`
	ToHub           string    `bson:"toHub"           json:"toHub"`
	Timestamp       time.Time `bson:"timestamp"       json:"timestamp"`
	CongestionLevel string    `bson:"congestionLevel" json:"congestionLevel"`
	AvgSpeedKmh     float64   `bson:"avgSpeedKmh"     json:"avgSpeedKmh"`
}
