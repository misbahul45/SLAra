package entities

type Hub struct {
	ID       string   `bson:"_id"      json:"id"`
	Name     string   `bson:"name"     json:"name"`
	Location GeoPoint `bson:"location" json:"location"`
	Capacity int      `bson:"capacity" json:"capacity"`
}
